import React from 'react';

/**
 * Honeypot component to prevent bot submissions.
 * It renders an invisible input field that humans won't see, 
 * but bots will often fill automatically.
 */
const Honeypot = ({ value, onChange, name = "website" }) => {
  return (
    <div style={{ position: 'absolute', left: '-5000px', ariaHidden: 'true' }}>
      <input
        type="text"
        name={name}
        tabIndex="-1"
        value={value}
        onChange={onChange}
        autoComplete="off"
      />
    </div>
  );
};

export default Honeypot;
