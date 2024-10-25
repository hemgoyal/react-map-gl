import React from "react";

export default function ResetControl(props) {
  const { onReset, draw } = props;

  const handleReset = () => {
    draw.deleteAll();
    onReset();
  };

  return (
    <div className="mapboxgl-ctrl-top-left" style={{ top: "165px" }}>
      <div className="mapboxgl-ctrl mapboxgl-ctrl-group">
        <button
          className="mapbox-gl-draw_reset"
          title="Reset"
          onClick={handleReset}
        />
      </div>
    </div>
  );
};
