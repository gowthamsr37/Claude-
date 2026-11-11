// Hand-curated metadata that the raw boundary files don't carry:
// clean display names, short labels, zones/continents and search aliases.

// ---------------------------------------------------------------- India ----
// Keyed by the ST_NM attribute in DataMeet's States/Admin2 shapefile.
// Zones follow India's Zonal Councils; the two island UTs get their own group.
export const INDIA = {
  'Andhra Pradesh':      { id: 'AP', kind: 'state', zone: 'South', aliases: ['Visakhapatnam', 'Vizag', 'Tirupati', 'Vijayawada', 'Amaravati', 'Araku'] },
  'Arunachal Pradesh':   { id: 'AR', kind: 'state', zone: 'Northeast', aliases: ['Tawang', 'Itanagar', 'Ziro'] },
  'Assam':               { id: 'AS', kind: 'state', zone: 'Northeast', aliases: ['Guwahati', 'Kaziranga', 'Majuli', 'Dibrugarh'] },
  'Bihar':               { id: 'BR', kind: 'state', zone: 'East', aliases: ['Patna', 'Bodh Gaya', 'Nalanda', 'Rajgir'] },
  'Chhattisgarh':        { id: 'CG', kind: 'state', zone: 'Central', aliases: ['Raipur', 'Bastar', 'Chitrakote'] },
  'Goa':                 { id: 'GA', kind: 'state', zone: 'West', aliases: ['Panaji', 'Panjim', 'Calangute', 'Baga', 'Palolem'] },
  'Gujarat':             { id: 'GJ', kind: 'state', zone: 'West', aliases: ['Ahmedabad', 'Surat', 'Vadodara', 'Kutch', 'Rann of Kutch', 'Dwarka', 'Somnath', 'Gir'] },
  'Haryana':             { id: 'HR', kind: 'state', zone: 'North', aliases: ['Gurugram', 'Gurgaon', 'Faridabad', 'Kurukshetra'] },
  'Himachal Pradesh':    { id: 'HP', kind: 'state', zone: 'North', aliases: ['Shimla', 'Manali', 'Dharamshala', 'McLeod Ganj', 'Spiti', 'Kasol', 'Dalhousie'] },
  'Jharkhand':           { id: 'JH', kind: 'state', zone: 'East', aliases: ['Ranchi', 'Jamshedpur', 'Deoghar'] },
  'Karnataka':           { id: 'KA', kind: 'state', zone: 'South', aliases: ['Bengaluru', 'Bangalore', 'Mysuru', 'Mysore', 'Coorg', 'Kodagu', 'Hampi', 'Gokarna', 'Chikmagalur', 'Mangaluru'] },
  'Kerala':              { id: 'KL', kind: 'state', zone: 'South', aliases: ['Kochi', 'Cochin', 'Munnar', 'Alleppey', 'Alappuzha', 'Thiruvananthapuram', 'Trivandrum', 'Varkala', 'Wayanad', 'Kozhikode'] },
  'Madhya Pradesh':      { id: 'MP', kind: 'state', zone: 'Central', aliases: ['Bhopal', 'Indore', 'Khajuraho', 'Ujjain', 'Gwalior', 'Pachmarhi', 'Kanha'] },
  'Maharashtra':         { id: 'MH', kind: 'state', zone: 'West', aliases: ['Mumbai', 'Bombay', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Lonavala', 'Mahabaleshwar', 'Ajanta', 'Ellora'] },
  'Manipur':             { id: 'MN', kind: 'state', zone: 'Northeast', aliases: ['Imphal', 'Loktak'] },
  'Meghalaya':           { id: 'ML', kind: 'state', zone: 'Northeast', aliases: ['Shillong', 'Cherrapunji', 'Sohra', 'Dawki', 'Mawlynnong'] },
  'Mizoram':             { id: 'MZ', kind: 'state', zone: 'Northeast', aliases: ['Aizawl'] },
  'Nagaland':            { id: 'NL', kind: 'state', zone: 'Northeast', aliases: ['Kohima', 'Dimapur', 'Hornbill'] },
  'Odisha':              { id: 'OD', kind: 'state', zone: 'East', aliases: ['Orissa', 'Bhubaneswar', 'Puri', 'Konark', 'Cuttack', 'Chilika'] },
  'Punjab':              { id: 'PB', kind: 'state', zone: 'North', aliases: ['Amritsar', 'Ludhiana', 'Jalandhar', 'Golden Temple'] },
  'Rajasthan':           { id: 'RJ', kind: 'state', zone: 'North', aliases: ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Pushkar', 'Mount Abu', 'Bikaner', 'Ranthambore'] },
  'Sikkim':              { id: 'SK', kind: 'state', zone: 'Northeast', aliases: ['Gangtok', 'Pelling', 'Lachung', 'Nathula'] },
  'Tamil Nadu':          { id: 'TN', kind: 'state', zone: 'South', aliases: ['Chennai', 'Madras', 'Madurai', 'Ooty', 'Kodaikanal', 'Coimbatore', 'Rameswaram', 'Kanyakumari', 'Mahabalipuram', 'Thanjavur'] },
  'Telangana':           { id: 'TS', kind: 'state', zone: 'South', aliases: ['Hyderabad', 'Warangal', 'Secunderabad'] },
  'Tripura':             { id: 'TR', kind: 'state', zone: 'Northeast', aliases: ['Agartala'] },
  'Uttar Pradesh':       { id: 'UP', kind: 'state', zone: 'Central', aliases: ['Lucknow', 'Agra', 'Taj Mahal', 'Varanasi', 'Banaras', 'Kashi', 'Prayagraj', 'Allahabad', 'Ayodhya', 'Mathura', 'Vrindavan', 'Noida'] },
  'Uttarakhand':         { id: 'UK', kind: 'state', zone: 'Central', aliases: ['Uttaranchal', 'Dehradun', 'Rishikesh', 'Haridwar', 'Nainital', 'Mussoorie', 'Kedarnath', 'Badrinath', 'Auli', 'Jim Corbett'] },
  'West Bengal':         { id: 'WB', kind: 'state', zone: 'East', aliases: ['Kolkata', 'Calcutta', 'Darjeeling', 'Sundarbans', 'Siliguri', 'Kalimpong'] },
  // Union Territories
  'Andaman & Nicobar':   { id: 'AN', kind: 'ut', zone: 'Islands', name: 'Andaman & Nicobar Islands', short: 'Andaman & Nicobar', label: { anchor: 'start', dx: 16, z: 1 }, aliases: ['Andaman', 'Nicobar', 'Port Blair', 'Havelock', 'Swaraj Dweep', 'Neil Island'] },
  'Chandigarh':          { id: 'CH', kind: 'ut', zone: 'North', label: { anchor: 'start', dx: 8, z: 3 }, aliases: [] },
  'Dadra and Nagar Haveli and Daman and Diu': { id: 'DH', kind: 'ut', zone: 'West', label: { anchor: 'end', dx: -9, z: 2.2 }, name: 'Dadra & Nagar Haveli and Daman & Diu', short: 'DNH & DD', aliases: ['Daman', 'Diu', 'Dadra', 'Nagar Haveli', 'Silvassa', 'DNH'] },
  'Delhi':               { id: 'DL', kind: 'ut', zone: 'North', aliases: ['New Delhi', 'NCT', 'National Capital Territory'] },
  'Jammu & Kashmir':     { id: 'JK', kind: 'ut', zone: 'North', name: 'Jammu & Kashmir', aliases: ['J&K', 'Kashmir', 'Jammu', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Vaishno Devi'] },
  'Ladakh':              { id: 'LA', kind: 'ut', zone: 'North', aliases: ['Leh', 'Kargil', 'Pangong', 'Nubra', 'Zanskar'] },
  'Lakshadweep':         { id: 'LD', kind: 'ut', zone: 'Islands', label: { anchor: 'end', dx: -9, z: 1 }, aliases: ['Kavaratti', 'Agatti', 'Bangaram', 'Laccadive'] },
  'Puducherry':          { id: 'PY', kind: 'ut', zone: 'South', label: { anchor: 'start', dx: 9, z: 2 }, aliases: ['Pondicherry', 'Pondy', 'Auroville', 'Karaikal', 'Mahe', 'Yanam'] },
};

export const INDIA_ZONES = ['North', 'Central', 'East', 'West', 'South', 'Northeast', 'Islands'];

// Seas and neighbours drawn faintly around the India map for context.
export const INDIA_SEAS = [
  { name: 'Arabian Sea', lon: 68.9, lat: 14.6, size: 1 },
  { name: 'Bay of Bengal', lon: 87.4, lat: 15.6, size: 1 },
  { name: 'Indian Ocean', lon: 85.6, lat: 7.0, size: 0.9 },
  { name: 'Andaman Sea', lon: 96.2, lat: 13.6, size: 0.7 },
  { name: 'Laccadive Sea', lon: 75.0, lat: 8.6, size: 0.7 },
];
export const INDIA_NEIGHBOURS = [
  { name: 'Pakistan', lon: 67.7, lat: 27.9 },
  { name: 'China', lon: 89.0, lat: 33.4 },
  { name: 'Nepal', lon: 83.9, lat: 28.25 },
  { name: 'Bhutan', lon: 90.45, lat: 27.45, small: true },
  { name: 'Bangladesh', lon: 90.1, lat: 23.85, small: true },
  { name: 'Myanmar', lon: 95.4, lat: 21.6 },
  { name: 'Sri Lanka', lon: 80.75, lat: 7.75, small: true },
  { name: 'Afghanistan', lon: 64.6, lat: 33.6 },
];

// ---------------------------------------------------------------- World ----
// The 193 UN member states plus the two UN observer states (Vatican, Palestine).
// Only these count towards the "x / 195 countries" figure; everything else is
// tracked as a territory or other region.
export const UN195 = new Set(`
AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH
CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI
FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP
KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM
NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST
SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV
UG UA AE GB US UY UZ VU VE VN YE ZM ZW VA PS`.trim().split(/\s+/));

// Natural Earth features we leave out of the selectable list entirely
// (uninhabited reefs and other specks no traveller "visits" on their own).
export const WORLD_DROP = new Set(['CSI', 'PGA', 'CLP', 'ATC', 'SCR']);
// Features drawn as plain land for completeness, but not selectable.
export const WORLD_CONTEXT = new Set(['ESB', 'WSB', 'USG', 'BRI', 'BRT']);

export const CONTINENTS = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica'];

// Friendlier display names (keyed by ADM0_A3); everything else uses NAME_EN.
export const WORLD_NAMES = {
  CHN: 'China', CZE: 'Czechia', CIV: "Côte d'Ivoire", TLS: 'Timor-Leste', SWZ: 'Eswatini',
  GMB: 'Gambia', BHS: 'Bahamas', CPV: 'Cabo Verde', STP: 'São Tomé and Príncipe',
  FSM: 'Micronesia', USA: 'United States', SHN: 'Saint Helena', TUR: 'Türkiye',
  SGS: 'South Georgia & S. Sandwich Is.', IOA: 'Christmas & Cocos Islands', MAC: 'Macau',
  HKG: 'Hong Kong', PSX: 'Palestine', VAT: 'Vatican City', UMI: 'U.S. Minor Outlying Islands',
  ATF: 'French Southern Lands', HMD: 'Heard & McDonald Islands', VIR: 'U.S. Virgin Islands',
  COG: 'Republic of the Congo', COD: 'DR Congo', IOT: 'British Indian Ocean Territory',
  BIH: 'Bosnia and Herzegovina', MKD: 'North Macedonia', VCT: 'St Vincent & the Grenadines',
  KNA: 'Saint Kitts and Nevis', ATG: 'Antigua and Barbuda', ALD: 'Åland Islands', FRO: 'Faroe Islands',
  SPM: 'Saint Pierre & Miquelon', BLM: 'Saint Barthélemy', MAF: 'Saint Martin', WLF: 'Wallis & Futuna',
  TCA: 'Turks & Caicos Islands', PCN: 'Pitcairn Islands', ATA: 'Antarctica', KOR: 'South Korea',
  PRK: 'North Korea', GBR: 'United Kingdom', ARE: 'United Arab Emirates', RUS: 'Russia', LAO: 'Laos',
  SYR: 'Syria', IRN: 'Iran', VNM: 'Vietnam', BRN: 'Brunei', BOL: 'Bolivia', VEN: 'Venezuela',
  TZA: 'Tanzania', MDA: 'Moldova', SRB: 'Serbia',
};

// Short labels for the map where the full name is long.
export const WORLD_SHORT = {
  USA: 'USA', GBR: 'UK', ARE: 'UAE', COD: 'DR Congo', COG: 'Congo', CAF: 'C. African Rep.',
  BIH: 'Bosnia & Herz.', DOM: 'Dominican Rep.', GNQ: 'Eq. Guinea', SDS: 'S. Sudan',
  SGS: 'S. Georgia', ATF: 'Fr. S. Lands', PNG: 'Papua New Guinea', MKD: 'N. Macedonia',
  SLB: 'Solomon Is.', VCT: 'St Vincent', KNA: 'St Kitts', ATG: 'Antigua', TTO: 'Trinidad',
  STP: 'São Tomé', UMI: 'U.S. Minor Is.', HMD: 'Heard I.', IOT: 'BIOT', IOA: 'Christmas I.',
  TCA: 'Turks & Caicos', SPM: 'St Pierre', VIR: 'USVI', VGB: 'BVI', FLK: 'Falklands',
  MNP: 'N. Mariana Is.', CYM: 'Cayman Is.', MHL: 'Marshall Is.', PYF: 'Fr. Polynesia',
};

// Flag overrides where ISO_A2_EH is missing or shared with the parent country.
export const WORLD_FLAG = { IOA: 'CX', TWN: 'TW', FRA: 'FR', NOR: 'NO', BRI: '', ESB: '', WSB: '', USG: '', BRT: '' };

// Search aliases: alternate names and popular destinations.
export const WORLD_ALIASES = {
  USA: ['USA', 'US', 'America', 'New York', 'Los Angeles', 'San Francisco', 'Las Vegas', 'Chicago', 'Hawaii', 'Alaska', 'Washington DC', 'Seattle', 'Boston', 'Orlando', 'Texas'],
  GBR: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'London', 'Edinburgh', 'Manchester'],
  ARE: ['UAE', 'Emirates', 'Dubai', 'Abu Dhabi', 'Sharjah'],
  SAU: ['KSA', 'Mecca', 'Makkah', 'Medina', 'Riyadh', 'Jeddah'],
  IDN: ['Bali', 'Jakarta', 'Lombok', 'Komodo'], THA: ['Siam', 'Bangkok', 'Phuket', 'Pattaya', 'Krabi', 'Chiang Mai', 'Koh Samui'],
  NPL: ['Kathmandu', 'Pokhara', 'Everest'], BTN: ['Thimphu', 'Paro', 'Punakha'], LKA: ['Ceylon', 'Colombo', 'Kandy', 'Galle'],
  MDV: ['Male'], BGD: ['Dhaka', "Cox's Bazar"], MMR: ['Burma', 'Yangon', 'Rangoon', 'Bagan'], PAK: ['Lahore', 'Karachi', 'Islamabad'],
  FRA: ['Paris', 'Nice', 'Lyon', 'Marseille', 'French Riviera'], ITA: ['Rome', 'Venice', 'Milan', 'Florence', 'Amalfi', 'Sicily'],
  ESP: ['Madrid', 'Barcelona', 'Seville', 'Ibiza', 'Canary Islands'], PRT: ['Lisbon', 'Porto', 'Madeira'],
  DEU: ['Berlin', 'Munich', 'Frankfurt', 'Hamburg'], NLD: ['Holland', 'Amsterdam', 'Rotterdam'], BEL: ['Brussels', 'Bruges'],
  CHE: ['Swiss', 'Zurich', 'Geneva', 'Interlaken', 'Lucerne', 'Zermatt'], AUT: ['Vienna', 'Salzburg', 'Innsbruck'],
  CZE: ['Czech Republic', 'Prague'], HUN: ['Budapest'], GRC: ['Athens', 'Santorini', 'Mykonos', 'Crete'],
  TUR: ['Turkey', 'Istanbul', 'Cappadocia', 'Antalya'], RUS: ['Moscow', 'St Petersburg', 'Siberia'], ISL: ['Reykjavik'],
  NOR: ['Oslo', 'Bergen', 'Tromso'], SWE: ['Stockholm'], DNK: ['Copenhagen'], FIN: ['Helsinki', 'Lapland'], IRL: ['Dublin'],
  POL: ['Warsaw', 'Krakow'], HRV: ['Zagreb', 'Dubrovnik', 'Split'], EGY: ['Cairo', 'Giza', 'Luxor', 'Sharm el Sheikh'],
  MAR: ['Marrakech', 'Casablanca', 'Fes'], KEN: ['Nairobi', 'Masai Mara'], TZA: ['Zanzibar', 'Kilimanjaro', 'Serengeti', 'Dar es Salaam'],
  ZAF: ['Cape Town', 'Johannesburg', 'Durban'], MUS: ['Port Louis'], SYC: ['Mahe', 'Victoria'],
  JPN: ['Tokyo', 'Kyoto', 'Osaka', 'Hokkaido'], KOR: ['Korea', 'Seoul', 'Busan', 'Jeju'], CHN: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'],
  HKG: ['HK'], MAC: ['Macao'], TWN: ['Taipei'], SGP: ['Singapura'], MYS: ['Kuala Lumpur', 'Langkawi', 'Penang'],
  VNM: ['Hanoi', 'Ho Chi Minh', 'Saigon', 'Da Nang', 'Ha Long'], KHM: ['Siem Reap', 'Angkor Wat', 'Phnom Penh'], LAO: ['Luang Prabang', 'Vientiane'],
  PHL: ['Manila', 'Boracay', 'Cebu', 'Palawan'], AUS: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Gold Coast'], NZL: ['Auckland', 'Queenstown', 'Wellington'],
  CAN: ['Toronto', 'Vancouver', 'Montreal', 'Banff', 'Niagara'], MEX: ['Mexico City', 'Cancun', 'Tulum'], BRA: ['Rio de Janeiro', 'Sao Paulo'],
  ARG: ['Buenos Aires', 'Patagonia'], PER: ['Lima', 'Cusco', 'Machu Picchu'], CHL: ['Santiago', 'Atacama'],
  QAT: ['Doha'], OMN: ['Muscat'], BHR: ['Manama'], KWT: ['Kuwait City'], JOR: ['Amman', 'Petra'], ISR: ['Jerusalem', 'Tel Aviv'],
  AZE: ['Baku'], GEO: ['Tbilisi'], ARM: ['Yerevan'], KAZ: ['Almaty', 'Astana'], UZB: ['Tashkent', 'Samarkand', 'Bukhara'],
  IRN: ['Persia', 'Tehran'], CIV: ['Ivory Coast'], SWZ: ['Swaziland'], TLS: ['East Timor'], CPV: ['Cape Verde'],
  VAT: ['Vatican', 'Holy See'], COD: ['DRC', 'Congo-Kinshasa', 'Kinshasa'], COG: ['Congo-Brazzaville'], MKD: ['Macedonia'],
  FJI: ['Suva', 'Nadi'], ATA: ['South Pole'], GRL: ['Nuuk'], PRI: ['San Juan'],
};
