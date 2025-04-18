import json
import os
import uuid
import logging
import requests
import threading
import time
from datetime import datetime
import numpy as np
import math

try:
    import osmnx as ox
    import networkx as nx
    from shapely.geometry import Point, LineString, Polygon
except ImportError:
    logging.warning("OSMnx or NetworkX not available, using fallback routing")
    ox = None
    nx = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OSMService:
    def __init__(self):
        self.obstacles = {}  # Dict to store obstacles with their IDs
        self.obstacle_lock = threading.Lock()
        self.graph = None
        self.nodes = None
        self.edges = None
        self.cached_routes = {}
        
        # OpenRouteService API key from environment
        self.ors_api_key = os.environ.get('OPENROUTE_API_KEY', '5b3ce3597851110001cf6248ff8dd7d0d0954ae99bbeb48b86fbdf9b')
        self.ors_url = "https://api.openrouteservice.org/v2/directions/driving-car"
        
        # Try to load OSM graph
        self._load_graph()
    
    def _load_graph(self):
        """Load OSM graph for the area of interest."""
        if ox is None or nx is None:
            logger.warning("OSMnx not available, will use OpenRouteService for routing")
            return
        
        try:
            # Default center is Amrita University, Coimbatore, India
            # You can change this to any location of your choice
            center_point = (10.9028, 76.9016)  # Lat, Lon
            
            # Download the street network
            self.graph = ox.graph_from_point(center_point, dist=1000, network_type="drive")
            
            # Project the graph to UTM coordinates
            self.graph = ox.project_graph(self.graph)
            
            # Get nodes and edges
            self.nodes = ox.graph_to_gdfs(self.graph, edges=False)
            self.edges = ox.graph_to_gdfs(self.graph, nodes=False)
            
            logger.info(f"OSM graph loaded with {len(self.nodes)} nodes and {len(self.edges)} edges")
        except Exception as e:
            logger.error(f"Error loading OSM graph: {str(e)}")
            self.graph = None
    
    def get_route(self, start, end, waypoints=None):
        """Get a route between start and end points, optionally via waypoints."""
        # If start or end is invalid, return an error
        if not start or not end:
            logger.error("Invalid start or end points")
            return {"error": "Invalid start or end points"}
        
        # Ensure waypoints is a list
        if waypoints is None:
            waypoints = []
        
        # Check if OSMnx is available and try to use it first
        if self.graph is not None and nx is not None:
            try:
                return self._get_route_osmnx(start, end, waypoints)
            except Exception as e:
                logger.error(f"Error getting route with OSMnx: {str(e)}")
                # Fall back to OpenRouteService
        
        # Use OpenRouteService as fallback
        return self._get_route_ors(start, end, waypoints)
    
    def _get_route_osmnx(self, start, end, waypoints):
        """Get a route using OSMnx and NetworkX."""
        # Convert points to tuples if they are not already
        start_point = tuple(start) if isinstance(start, list) else (start['lat'], start['lng'])
        end_point = tuple(end) if isinstance(end, list) else (end['lat'], end['lng'])
        
        # Find the nearest nodes to start and end points
        start_node = ox.nearest_nodes(self.graph, start_point[1], start_point[0])
        end_node = ox.nearest_nodes(self.graph, end_point[1], end_point[0])
        
        # Initialize route with just the start-to-end path
        route_parts = []
        
        # If there are waypoints, calculate route through them
        if waypoints and len(waypoints) > 0:
            # Ensure waypoints are in correct format
            waypoint_nodes = []
            for wp in waypoints:
                wp_point = tuple(wp) if isinstance(wp, list) else (wp['lat'], wp['lng'])
                wp_node = ox.nearest_nodes(self.graph, wp_point[1], wp_point[0])
                waypoint_nodes.append(wp_node)
            
            # Calculate route through all waypoints
            prev_node = start_node
            for wp_node in waypoint_nodes:
                try:
                    # Find shortest path between previous point and this waypoint
                    path = nx.shortest_path(self.graph, prev_node, wp_node, weight='length')
                    route_parts.append(path)
                    prev_node = wp_node
                except nx.NetworkXNoPath:
                    logger.warning(f"No path found to waypoint, skipping")
            
            # Add final leg from last waypoint to end
            try:
                path = nx.shortest_path(self.graph, prev_node, end_node, weight='length')
                route_parts.append(path)
            except nx.NetworkXNoPath:
                logger.warning(f"No path found from last waypoint to end")
        else:
            # Just find route from start to end
            try:
                path = nx.shortest_path(self.graph, start_node, end_node, weight='length')
                route_parts.append(path)
            except nx.NetworkXNoPath:
                logger.error(f"No path found from start to end")
                return {"error": "No route found"}
        
        # Extract coordinates from the route
        coordinates = []
        
        for path in route_parts:
            for node in path:
                # Get the node's coordinates
                y, x = self.nodes.loc[node]['y'], self.nodes.loc[node]['x']
                coordinates.append([y, x])
        
        # Calculate approximate distance and duration
        distance = 0
        for i in range(len(coordinates) - 1):
            distance += self._haversine_distance(coordinates[i], coordinates[i+1])
        
        # Assume average speed of 30 km/h
        duration = (distance / 30) * 3600  # seconds
        
        return {
            "coordinates": coordinates,
            "distance": distance,
            "duration": duration
        }
    
    def _get_route_ors(self, start, end, waypoints):
        """Get a route using OpenRouteService API."""
        # Format the start and end points for ORS
        if isinstance(start, list):
            start_coord = [start[1], start[0]]  # ORS expects [lon, lat]
        else:
            start_coord = [start["lng"], start["lat"]]
        
        if isinstance(end, list):
            end_coord = [end[1], end[0]]
        else:
            end_coord = [end["lng"], end["lat"]]
        
        # Format waypoints
        waypoint_coords = []
        if waypoints and len(waypoints) > 0:
            for wp in waypoints:
                if isinstance(wp, list):
                    waypoint_coords.append([wp[1], wp[0]])
                else:
                    waypoint_coords.append([wp["lng"], wp["lat"]])
        
        # Combine all coordinates
        coordinates = [start_coord] + waypoint_coords + [end_coord]
        
        # Prepare request data
        headers = {
            'Accept': 'application/json, application/geo+json, application/gpx+xml',
            'Content-Type': 'application/json',
            'Authorization': self.ors_api_key
        }
        
        data = {
            "coordinates": coordinates,
            "instructions": "false",
            "preference": "shortest"
        }
        
        try:
            response = requests.post(self.ors_url, json=data, headers=headers)
            response.raise_for_status()
            
            route_data = response.json()
            
            # Extract coordinates from response
            route_coords = []
            if 'routes' in route_data and len(route_data['routes']) > 0:
                geometry = route_data['routes'][0]['geometry']
                if 'coordinates' in geometry:
                    for coord in geometry['coordinates']:
                        # Convert [lon, lat] to [lat, lon] for consistency
                        route_coords.append([coord[1], coord[0]])
                
                distance = route_data['routes'][0]['summary']['distance']  # meters
                duration = route_data['routes'][0]['summary']['duration']  # seconds
                
                return {
                    "coordinates": route_coords,
                    "distance": distance,
                    "duration": duration
                }
            else:
                logger.error("No route found in ORS response")
                return {"error": "No route found"}
            
        except Exception as e:
            logger.error(f"Error getting route from OpenRouteService: {str(e)}")
            
            # Fallback: return a direct line between points
            return self._get_direct_route(start, end, waypoints)
    
    def _get_direct_route(self, start, end, waypoints):
        """Create a direct straight-line route between points."""
        # Format points to [lat, lon]
        if isinstance(start, list):
            start_point = start
        else:
            start_point = [start["lat"], start["lng"]]
        
        if isinstance(end, list):
            end_point = end
        else:
            end_point = [end["lat"], end["lng"]]
        
        # Format waypoints
        waypoint_points = []
        if waypoints and len(waypoints) > 0:
            for wp in waypoints:
                if isinstance(wp, list):
                    waypoint_points.append(wp)
                else:
                    waypoint_points.append([wp["lat"], wp["lng"]])
        
        # Combine all coordinates
        coordinates = [start_point] + waypoint_points + [end_point]
        
        # Calculate approximate distance and duration
        distance = 0
        for i in range(len(coordinates) - 1):
            distance += self._haversine_distance(coordinates[i], coordinates[i+1])
        
        # Assume average speed of 30 km/h
        duration = (distance / 30) * 3600  # seconds
        
        return {
            "coordinates": coordinates,
            "distance": distance,
            "duration": duration
        }
    
    def _haversine_distance(self, point1, point2):
        """Calculate the great-circle distance between two points in km."""
        # Convert decimal degrees to radians
        lat1 = math.radians(point1[0])
        lon1 = math.radians(point1[1])
        lat2 = math.radians(point2[0])
        lon2 = math.radians(point2[1])
        
        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371  # Earth radius in km
        return c * r
    
    def add_obstacle(self, position, size=1.0):
        """Add a new obstacle to the map."""
        obstacle_id = str(uuid.uuid4())
        
        # Create obstacle object
        obstacle = {
            "id": obstacle_id,
            "position": position,  # [lat, lon]
            "size": size,
            "timestamp": datetime.now().isoformat()
        }
        
        # Add to obstacles dictionary
        with self.obstacle_lock:
            self.obstacles[obstacle_id] = obstacle
        
        logger.info(f"Added obstacle {obstacle_id} at position {position}")
        return obstacle_id
    
    def remove_obstacle(self, obstacle_id):
        """Remove an obstacle by ID."""
        with self.obstacle_lock:
            if obstacle_id in self.obstacles:
                del self.obstacles[obstacle_id]
                logger.info(f"Removed obstacle {obstacle_id}")
                return True
            else:
                logger.warning(f"Obstacle {obstacle_id} not found")
                return False
    
    def get_obstacles(self):
        """Get all obstacles."""
        with self.obstacle_lock:
            return list(self.obstacles.values())
    
    def clear_obstacles(self):
        """Clear all obstacles."""
        with self.obstacle_lock:
            self.obstacles.clear()
        logger.info("All obstacles cleared")
    
    def reroute(self, current_position, destination):
        """Generate a new route avoiding obstacles."""
        # Get all obstacles
        with self.obstacle_lock:
            obstacles = list(self.obstacles.values())
        
        # If there are no obstacles, just get a regular route
        if not obstacles:
            return self.get_route(current_position, destination)
        
        # If we have NetworkX and OSMnx available, use them for rerouting
        if self.graph is not None and nx is not None:
            try:
                return self._reroute_osmnx(current_position, destination, obstacles)
            except Exception as e:
                logger.error(f"Error rerouting with OSMnx: {str(e)}")
        
        # Otherwise, just try to use waypoints to avoid obstacles
        return self._reroute_waypoints(current_position, destination, obstacles)
    
    def _reroute_osmnx(self, current_position, destination, obstacles):
        """Generate a new route using OSMnx, avoiding obstacles."""
        # Convert points to tuples if they are not already
        start_point = tuple(current_position) if isinstance(current_position, list) else (current_position['lat'], current_position['lng'])
        end_point = tuple(destination) if isinstance(destination, list) else (destination['lat'], destination['lng'])
        
        # Find the nearest nodes to start and end points
        start_node = ox.nearest_nodes(self.graph, start_point[1], start_point[0])
        end_node = ox.nearest_nodes(self.graph, end_point[1], end_point[0])
        
        # Create a copy of the graph for modification
        G = self.graph.copy()
        
        # Mark edges near obstacles with high weights to avoid them
        for edge in G.edges(data=True):
            u, v, data = edge
            
            # Get edge geometry
            if 'geometry' in data:
                edge_geom = data['geometry']
            else:
                # Create a straight line if no geometry is available
                x1, y1 = G.nodes[u]['x'], G.nodes[u]['y']
                x2, y2 = G.nodes[v]['x'], G.nodes[v]['y']
                edge_geom = LineString([(x1, y1), (x2, y2)])
            
            # Check if edge is near any obstacle
            for obstacle in obstacles:
                obstacle_point = Point(obstacle["position"][1], obstacle["position"][0])
                
                # Calculate buffer based on obstacle size (approximate meters to degrees)
                buffer_size = obstacle["size"] / 111000  # Roughly converts meters to degrees
                
                # If edge is within buffer distance of obstacle, increase its weight
                if edge_geom.distance(obstacle_point) < buffer_size:
                    # Set a very high weight to avoid this edge
                    G[u][v][0]['length'] = G[u][v][0]['length'] * 100
        
        # Find new path with modified weights
        try:
            path = nx.shortest_path(G, start_node, end_node, weight='length')
            
            # Extract coordinates from the route
            coordinates = []
            for node in path:
                # Get the node's coordinates
                y, x = self.nodes.loc[node]['y'], self.nodes.loc[node]['x']
                coordinates.append([y, x])
            
            # Calculate distance and duration
            distance = 0
            for i in range(len(coordinates) - 1):
                distance += self._haversine_distance(coordinates[i], coordinates[i+1])
            
            # Assume average speed of 30 km/h
            duration = (distance / 30) * 3600  # seconds
            
            return {
                "coordinates": coordinates,
                "distance": distance,
                "duration": duration
            }
            
        except nx.NetworkXNoPath:
            logger.error("No path found after avoiding obstacles")
            # Fall back to direct routing
            return self._reroute_waypoints(current_position, destination, obstacles)
    
    def _reroute_waypoints(self, current_position, destination, obstacles):
        """Generate a new route using waypoints to avoid obstacles."""
        # Create waypoints to avoid obstacles
        waypoints = []
        
        # Get direct route first
        direct_route = self._get_direct_route(current_position, destination, [])
        
        # Check if direct route intersects with any obstacles
        route_coords = direct_route["coordinates"]
        
        # For each segment in the route
        for i in range(len(route_coords) - 1):
            segment_start = route_coords[i]
            segment_end = route_coords[i + 1]
            
            # Check segment against each obstacle
            for obstacle in obstacles:
                obstacle_pos = obstacle["position"]
                obstacle_size = obstacle["size"]
                
                # Calculate if segment passes near obstacle
                if self._segment_near_obstacle(segment_start, segment_end, obstacle_pos, obstacle_size):
                    # Create avoidance waypoint
                    avoid_wp = self._create_avoidance_waypoint(segment_start, segment_end, obstacle_pos, obstacle_size)
                    waypoints.append(avoid_wp)
        
        # If we have waypoints, get a new route through them
        if waypoints:
            return self.get_route(current_position, destination, waypoints)
        else:
            # No obstacles in the way, return direct route
            return direct_route
    
    def _segment_near_obstacle(self, segment_start, segment_end, obstacle_pos, obstacle_size):
        """Check if a line segment passes near an obstacle."""
        # Convert obstacle size to approximate degrees
        buffer_size = obstacle_size / 111000  # Roughly converts meters to degrees
        
        # Calculate the squared distance from the point to the line segment
        def dist_point_to_segment_squared(p, s1, s2):
            if s1[0] == s2[0] and s1[1] == s2[1]:  # segment is a point
                return (p[0] - s1[0])**2 + (p[1] - s1[1])**2
            
            # Calculate vectors
            line_vec = [s2[0] - s1[0], s2[1] - s1[1]]
            point_vec = [p[0] - s1[0], p[1] - s1[1]]
            
            # Calculate length squared of line segment
            line_len_sq = line_vec[0]**2 + line_vec[1]**2
            
            # Calculate dot product
            dot_product = point_vec[0] * line_vec[0] + point_vec[1] * line_vec[1]
            
            # Calculate projection factor
            t = max(0, min(1, dot_product / line_len_sq))
            
            # Calculate closest point on segment
            proj = [s1[0] + t * line_vec[0], s1[1] + t * line_vec[1]]
            
            # Return squared distance
            return (p[0] - proj[0])**2 + (p[1] - proj[1])**2
        
        # Check if distance is less than buffer size
        dist_sq = dist_point_to_segment_squared(obstacle_pos, segment_start, segment_end)
        return dist_sq < buffer_size**2
    
    def _create_avoidance_waypoint(self, segment_start, segment_end, obstacle_pos, obstacle_size):
        """Create a waypoint to avoid an obstacle."""
        # Convert obstacle size to approximate degrees with extra buffer
        buffer_size = (obstacle_size * 2) / 111000  # Double size for safety
        
        # Calculate vector from obstacle to segment
        def calculate_vector(p, s1, s2):
            # Calculate vectors
            line_vec = [s2[0] - s1[0], s2[1] - s1[1]]
            point_vec = [p[0] - s1[0], p[1] - s1[1]]
            
            # Calculate length squared of line segment
            line_len_sq = line_vec[0]**2 + line_vec[1]**2
            
            # Calculate dot product
            dot_product = point_vec[0] * line_vec[0] + point_vec[1] * line_vec[1]
            
            # Calculate projection factor
            t = max(0, min(1, dot_product / line_len_sq))
            
            # Calculate closest point on segment
            proj = [s1[0] + t * line_vec[0], s1[1] + t * line_vec[1]]
            
            # Calculate vector from projection to obstacle
            vec = [p[0] - proj[0], p[1] - proj[1]]
            
            # Normalize vector
            dist = math.sqrt(vec[0]**2 + vec[1]**2)
            if dist > 0:
                vec[0] /= dist
                vec[1] /= dist
            
            return vec, proj, t
        
        # Get avoidance vector and projection
        avoid_vec, proj_point, t = calculate_vector(obstacle_pos, segment_start, segment_end)
        
        # Create waypoint in opposite direction of obstacle
        waypoint = [
            obstacle_pos[0] - avoid_vec[0] * buffer_size * 2,
            obstacle_pos[1] - avoid_vec[1] * buffer_size * 2
        ]
        
        return waypoint 