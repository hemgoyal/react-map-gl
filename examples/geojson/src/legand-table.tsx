import * as React from 'react';

function LegandTable() {

  return (
    <div className="control-panel">
      <h3>Legends</h3>
      <hr />
      <ul className="legandsList">
        <li className="deep-rural">Deep Rural Towns</li>
        <li className="rest-of-rural">Rest of Rural</li>
        <li className="rural-b-towns">Rural B Towns</li>
        <li className="rural-c-towns">Rural C Towns</li>
        <li className="urban-towns">Urban Towns</li>
      </ul>
    </div>
  );
}

export default React.memo(LegandTable);