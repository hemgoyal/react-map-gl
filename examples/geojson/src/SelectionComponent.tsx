import React, { useState } from 'react';
import { Row, Col, Select, Button } from 'antd';

const countryList = [{
  value: "india",
  label: "India"
}];

const _stateList = [{
  value: "karnataka",
  label: "Karnataka",
  country: "india"
}, {
  value: "up",
  label: "Uttar Pradesh",
  country: "india"
}];

const _districtList = [{
  value: "mysuru",
  label: "Mysuru",
  state: "karnataka"
}, {
  value: "gorakhpur",
  label: "Gorakhpur",
  state: "up"
}];

const _cityList = [{
  value: "mysuru",
  label: "Mysore",
  district: "mysuru"
}, {
  value: "gorakhpur",
  label: "Gorakhpur",
  district: "gorakhpur"
}];

function SelectionComponent(props) {
  const { handleLoadMap } = props;

  const [stateList, setStateList] = useState([]);
  const [districtList, setDistrictList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');

  const handleCountryChange = (value) => {
    const list = _stateList.filter(state => state.country === value);
    setStateList(list);
  };

  const handleStateChange = (value) => {
    const list = _districtList.filter(district => district.state === value);
    setDistrictList(list);
  };

  const handleDistrictChange = (value) => {
    const list = _cityList.filter(city => city.district === value);
    setCityList(list);
  };

  const handleCityChange = (value) => {
    setSelectedCity(value);
  };

  const handleClick = () => {
    handleLoadMap(selectedCity);
  };

  return (
    <div className="selectionPanel">
      <Row gutter={8}>
        <Col span={5}>
          <Select
            placeholder="Select Country"
            options={countryList}
            onChange={handleCountryChange}
            style={{
              width: "100%"
            }}
          />
        </Col>
        <Col span={5}>
          <Select
            placeholder="Select State"
            options={stateList}
            onChange={handleStateChange}
            style={{
              width: "100%"
            }}
          />
        </Col>
        <Col span={5}>
          <Select
            placeholder="Select District"
            options={districtList}
            onChange={handleDistrictChange}
            style={{
              width: "100%"
            }}
          />
        </Col>
        <Col span={5}>
          <Select
            placeholder="Select City"
            options={cityList}
            onChange={handleCityChange}
            style={{
              width: "100%"
            }}
          />
        </Col>
        <Col span={4}>
          <Button
            onClick={handleClick}
            disabled={!!!selectedCity}
            style={{
              width: "100%"
            }}
          >
            Load Sectors
          </Button>
        </Col>
      </Row>
    </div>
  );
}

export default React.memo(SelectionComponent);