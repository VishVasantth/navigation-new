import React from 'react';

// SVG Arrow components
const StraightArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M12,4L12,20M12,4L8,8M12,4L16,8" />
  </svg>
);

const RightArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M4,12L17,12M17,12L13,8M17,12L13,16" />
  </svg>
);

const SlightRightArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M6,18L18,6M18,6L13,7M18,6L17,11" />
  </svg>
);

const SharpRightArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M6,20L6,12L6,4L14,12M14,12L9,9M14,12L9,15" />
  </svg>
);

const LeftArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M20,12L7,12M7,12L11,8M7,12L11,16" />
  </svg>
);

const SlightLeftArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M18,18L6,6M6,6L11,7M6,6L7,11" />
  </svg>
);

const SharpLeftArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M18,20L18,12L18,4L10,12M10,12L15,9M10,12L15,15" />
  </svg>
);

const UTurnArrow = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M12,4L12,16C12,18,14,20,16,20M16,20L20,20M12,4L8,8M12,4L16,8" />
  </svg>
);

const DestinationFlag = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path d="M12,4L12,20M8,8L16,8L16,16L8,16L8,8Z" />
  </svg>
);

const NavigationCard = ({ instruction, isUpcoming = false }) => {
  // Parse the instruction to determine the direction type
  const getDirectionInfo = (text) => {
    if (!text) return { component: <StraightArrow />, direction: 'up' };
    
    if (text.includes('straight')) 
      return { component: <StraightArrow />, direction: 'up' };
    
    if (text.includes('left') && text.includes('sharp')) 
      return { component: <SharpLeftArrow />, direction: 'left' };
    
    if (text.includes('left') && text.includes('slightly')) 
      return { component: <SlightLeftArrow />, direction: 'left' };
    
    if (text.includes('left')) 
      return { component: <LeftArrow />, direction: 'left' };
    
    if (text.includes('right') && text.includes('sharp')) 
      return { component: <SharpRightArrow />, direction: 'right' };
    
    if (text.includes('right') && text.includes('slightly')) 
      return { component: <SlightRightArrow />, direction: 'right' };
    
    if (text.includes('right')) 
      return { component: <RightArrow />, direction: 'right' };
    
    if (text.includes('U-turn') || text.includes('turn around')) 
      return { component: <UTurnArrow />, direction: 'uturn' };
    
    if (text.includes('destination')) 
      return { component: <DestinationFlag />, direction: 'destination' };
    
    return { component: <StraightArrow />, direction: 'up' }; // Default
  };
  
  // Get the direction arrow based on the instruction text
  const { component, direction } = getDirectionInfo(instruction);
  
  // Only render if we have an instruction
  if (!instruction) return null;
  
  // Apply different styling for upcoming instructions
  const cardClass = `navigation-card ${isUpcoming ? 'upcoming' : 'current'}`;
  
  return (
    <div className={cardClass}>
      <div className="direction-arrow" data-direction={direction}>
        {component}
      </div>
      <div className="instruction-text">{instruction}</div>
    </div>
  );
};

export default NavigationCard; 