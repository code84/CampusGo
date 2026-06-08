// Predefined IITR campus pickup/destination points with approx coordinates
export const CAMPUS_LOCATIONS = [
  { label: "Main Gate", lat: 29.8657, lng: 77.8964 },
  { label: "Lecture Hall Complex", lat: 29.8650, lng: 77.8978 },
  { label: "Central Library", lat: 29.8640, lng: 77.8951 },
  { label: "Mahatma Gandhi Bhawan", lat: 29.8633, lng: 77.8990 },
  { label: "Cautley Bhawan", lat: 29.8665, lng: 77.8985 },
  { label: "Govind Bhawan", lat: 29.8628, lng: 77.8960 },
  { label: "Multi-Activity Centre (MAC)", lat: 29.8672, lng: 77.8945 },
  { label: "Sports Complex", lat: 29.8689, lng: 77.8932 },
  { label: "Tinkering Lab / iHub", lat: 29.8645, lng: 77.9001 },
  { label: "Department of Computer Science", lat: 29.8660, lng: 77.8990 },
  { label: "Bharat Petroleum Pump", lat: 29.8610, lng: 77.8945 },
  { label: "Roorkee Railway Station", lat: 29.8550, lng: 77.8870 },
];

export function findLocation(label) {
  return CAMPUS_LOCATIONS.find((l) => l.label === label);
}
