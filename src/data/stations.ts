import type { Station } from '../types/journey.ts'

/** Curated station sample for the synthetic demo, not a complete Indian railway station register.
 * Codes are populated only for familiar codes confirmed against the Railway Board TAG 2026 station-code index.
 * Territories without a currently connected passenger railway are documented in territoryCoverage below.
 */
type Entry = readonly [name: string, city: string, code?: string]
type Region = readonly [stateOrUT: string, hubId: string, entries: readonly Entry[]]

const regions: readonly Region[] = [
  ['Andhra Pradesh', 'Vijayawada', [
    ['Visakhapatnam Junction', 'Visakhapatnam', 'VSKP'], ['Vijayawada Junction', 'Vijayawada', 'BZA'], ['Tirupati', 'Tirupati', 'TPTY'], ['Guntur Junction', 'Guntur', 'GNT'], ['Nellore', 'Nellore', 'NLR'], ['Rajahmundry', 'Rajahmundry', 'RJY'], ['Kakinada Town', 'Kakinada', 'CCT'], ['Anantapur', 'Anantapur', 'ATP'], ['Kurnool City', 'Kurnool'], ['Kadapa', 'Kadapa', 'HX'], ['Chittoor', 'Chittoor'], ['Eluru', 'Eluru', 'EE'], ['Ongole', 'Ongole', 'OGL'], ['Srikakulam Road', 'Srikakulam', 'CHE'], ['Anakapalle', 'Anakapalle', 'AKP'], ['Tenali Junction', 'Tenali', 'TEL'], ['Machilipatnam', 'Machilipatnam', 'MTM'], ['Hindupur', 'Hindupur', 'HUP'], ['Dharmavaram Junction', 'Dharmavaram', 'DMM'], ['Proddatur', 'Proddatur', 'PRDT'],
  ]],
  ['Arunachal Pradesh', 'Guwahati', [['Naharlagun', 'Itanagar', 'NHLN'], ['Banderdewa', 'Banderdewa']]],
  ['Assam', 'Guwahati', [
    ['Guwahati', 'Guwahati', 'GHY'], ['Dibrugarh', 'Dibrugarh', 'DBRG'], ['Silchar', 'Silchar', 'SCL'], ['Jorhat Town', 'Jorhat', 'JTTN'], ['Tinsukia Junction', 'Tinsukia', 'NTSK'], ['New Bongaigaon Junction', 'Bongaigaon', 'NBQ'], ['Lumding Junction', 'Lumding', 'LMG'], ['Mariani Junction', 'Mariani', 'MXN'], ['Kokrajhar', 'Kokrajhar', 'KOJ'], ['Rangiya Junction', 'Rangiya', 'RNY'], ['Diphu', 'Diphu', 'DPU'], ['Badarpur Junction', 'Badarpur', 'BPB'], ['Furkating Junction', 'Furkating', 'FKG'], ['Simaluguri Junction', 'Simaluguri', 'SLGR'], ['New Haflong', 'Haflong', 'NHLG'], ['North Lakhimpur', 'North Lakhimpur', 'NLP'], ['Duliajan', 'Duliajan', 'DJG'], ['Goalpara Town', 'Goalpara', 'GLPT'],
  ]],
  ['Bihar', 'Patna', [
    ['Patna Junction', 'Patna', 'PNBE'], ['Gaya Junction', 'Gaya', 'GAYA'], ['Muzaffarpur Junction', 'Muzaffarpur', 'MFP'], ['Darbhanga Junction', 'Darbhanga', 'DBG'], ['Bhagalpur Junction', 'Bhagalpur', 'BGP'], ['Purnia Junction', 'Purnia', 'PRNA'], ['Katihar Junction', 'Katihar', 'KIR'], ['Samastipur Junction', 'Samastipur', 'SPJ'], ['Barauni Junction', 'Barauni', 'BJU'], ['Ara Junction', 'Ara', 'ARA'], ['Buxar', 'Buxar', 'BXR'], ['Hajipur Junction', 'Hajipur', 'HJP'], ['Jaynagar', 'Jaynagar', 'JYG'], ['Sitamarhi', 'Sitamarhi', 'SMI'], ['Saharsa Junction', 'Saharsa', 'SHC'], ['Begusarai', 'Begusarai', 'BGS'], ['Kishanganj', 'Kishanganj', 'KNE'], ['Sasaram', 'Sasaram', 'SSM'], ['Munger', 'Munger'], ['Motihari', 'Motihari'],
  ]],
  ['Chhattisgarh', 'Raipur', [
    ['Raipur Junction', 'Raipur', 'R'], ['Bilaspur Junction', 'Bilaspur', 'BSP'], ['Durg Junction', 'Durg', 'DURG'], ['Bhilai Power House', 'Bhilai', 'BPHB'], ['Korba', 'Korba', 'KRBA'], ['Raigarh', 'Raigarh', 'RIG'], ['Jagdalpur', 'Jagdalpur', 'JDB'], ['Ambikapur', 'Ambikapur', 'ABKP'], ['Rajnandgaon', 'Rajnandgaon', 'RJN'], ['Champa Junction', 'Champa', 'CPH'],
  ]],
  ['Goa', 'Madgaon', [['Madgaon Junction', 'Margao', 'MAO'], ['Vasco-da-Gama', 'Vasco da Gama', 'VSG'], ['Thivim', 'Mapusa', 'THVM'], ['Karmali', 'Old Goa', 'KRMI'], ['Canacona', 'Canacona', 'CNO'], ['Pernem', 'Pernem', 'PERN']]],
  ['Gujarat', 'Ahmedabad', [
    ['Ahmedabad Junction', 'Ahmedabad', 'ADI'], ['Surat', 'Surat', 'ST'], ['Vadodara Junction', 'Vadodara', 'BRC'], ['Rajkot Junction', 'Rajkot', 'RJT'], ['Bhavnagar Terminus', 'Bhavnagar', 'BVC'], ['Jamnagar', 'Jamnagar', 'JAM'], ['Junagadh Junction', 'Junagadh', 'JND'], ['Porbandar', 'Porbandar', 'PBR'], ['Gandhidham Junction', 'Gandhidham', 'GIMB'], ['Bhuj', 'Bhuj', 'BHUJ'], ['Anand Junction', 'Anand', 'ANND'], ['Nadiad Junction', 'Nadiad', 'ND'], ['Vapi', 'Vapi', 'VAPI'], ['Valsad', 'Valsad', 'BL'], ['Bharuch Junction', 'Bharuch', 'BH'], ['Palanpur Junction', 'Palanpur', ' PNU'], ['Gandhinagar Capital', 'Gandhinagar', 'GNC'], ['Mehsana Junction', 'Mehsana', 'MSH'], ['Surendranagar', 'Surendranagar', 'SUNR'], ['Veraval', 'Veraval', 'VRL'], ['Morbi', 'Morbi', 'MVI'], ['Dahod', 'Dahod', 'DHD'],
  ]],
  ['Haryana', 'New Delhi', [['Ambala Cantt Junction', 'Ambala', 'UMB'], ['Gurugram', 'Gurugram', 'GGN'], ['Faridabad', 'Faridabad', 'FDB'], ['Panipat Junction', 'Panipat', 'PNP'], ['Hisar', 'Hisar', 'HSR'], ['Rohtak Junction', 'Rohtak', 'ROK'], ['Karnal', 'Karnal', 'KUN'], ['Kurukshetra Junction', 'Kurukshetra', 'KKDE'], ['Sirsa', 'Sirsa', 'SSA'], ['Rewari Junction', 'Rewari', 'RE'], ['Bhiwani Junction', 'Bhiwani', 'BNW'], ['Jind Junction', 'Jind', 'JIND'], ['Yamunanagar-Jagadhri', 'Yamunanagar', 'YJUD']]],
  ['Himachal Pradesh', 'Chandigarh', [['Shimla', 'Shimla', 'SML'], ['Kalka', 'Kalka', 'KLK'], ['Una Himachal', 'Una', 'UHL'], ['Pathankot', 'Pathankot', 'PTK'], ['Joginder Nagar', 'Joginder Nagar', 'JDNX'], ['Solan', 'Solan', 'SOL'], ['Baijnath Paprola', 'Baijnath', 'BJPL']]],
  ['Jharkhand', 'Ranchi', [['Ranchi Junction', 'Ranchi', 'RNC'], ['Tatanagar Junction', 'Jamshedpur', 'TATA'], ['Dhanbad Junction', 'Dhanbad', 'DHN'], ['Bokaro Steel City', 'Bokaro', 'BKSC'], ['Deoghar', 'Deoghar', 'DGHR'], ['Jasidih Junction', 'Jasidih', 'JSME'], ['Hazaribagh Road', 'Hazaribagh', 'HZD'], ['Giridih', 'Giridih', 'GRD'], ['Chakradharpur', 'Chakradharpur', 'CKP'], ['Ghatshila', 'Ghatshila', 'GTS'], ['Madhupur Junction', 'Madhupur', 'MDP']]],
  ['Karnataka', 'Bengaluru', [['KSR Bengaluru City', 'Bengaluru', 'SBC'], ['Yesvantpur Junction', 'Bengaluru', 'YPR'], ['Mysuru Junction', 'Mysuru', 'MYS'], ['Mangaluru Central', 'Mangaluru', 'MAQ'], ['Hubballi Junction', 'Hubballi', 'UBL'], ['Belagavi', 'Belagavi', 'BGM'], ['Kalaburagi', 'Kalaburagi', 'KLBG'], ['Shivamogga Town', 'Shivamogga', 'SMET'], ['Ballari Junction', 'Ballari', 'BAY'], ['Davangere', 'Davangere', 'DVG'], ['Tumakuru', 'Tumakuru', 'TK'], ['Hassan', 'Hassan', 'HAS'], ['Udupi', 'Udupi', 'UD'], ['Vijayapura', 'Vijayapura', 'BJP'], ['Raichur', 'Raichur', 'RC'], ['Bidar', 'Bidar', 'BIDR'], ['Chikkamagaluru', 'Chikkamagaluru', 'CMGR'], ['Chitradurga', 'Chitradurga', 'CTA'], ['Kolar', 'Kolar', 'KQZ'], ['Bagalkot', 'Bagalkot', 'BGK']]],
  ['Kerala', 'Ernakulam Junction', [['Thiruvananthapuram Central', 'Thiruvananthapuram', 'TVC'], ['Ernakulam Junction', 'Kochi', 'ERS'], ['Kozhikode', 'Kozhikode', 'CLT'], ['Thrissur', 'Thrissur', 'TCR'], ['Kollam Junction', 'Kollam', 'QLN'], ['Alappuzha', 'Alappuzha', 'ALLP'], ['Kannur', 'Kannur', 'CAN'], ['Palakkad Junction', 'Palakkad', 'PGT'], ['Kottayam', 'Kottayam', 'KTYM'], ['Kasaragod', 'Kasaragod', 'KGQ'], ['Shoranur Junction', 'Shoranur', 'SRR'], ['Guruvayur', 'Guruvayur', 'GUV'], ['Thalassery', 'Thalassery', 'TLY'], ['Chengannur', 'Chengannur', 'CNGR'], ['Tirur', 'Tirur', 'TIR'], ['Varkala Sivagiri', 'Varkala', 'VAK']]],
  ['Madhya Pradesh', 'Bhopal', [['Bhopal Junction', 'Bhopal', 'BPL'], ['Indore Junction BG', 'Indore', 'INDB'], ['Jabalpur Junction', 'Jabalpur', 'JBP'], ['Gwalior Junction', 'Gwalior', 'GWL'], ['Ujjain Junction', 'Ujjain', 'UJN'], ['Itarsi Junction', 'Itarsi', 'ET'], ['Sagar', 'Sagar', 'SGO'], ['Satna', 'Satna', 'STA'], ['Rewa', 'Rewa', 'REWA'], ['Ratlam Junction', 'Ratlam', 'RTM'], ['Katni Junction', 'Katni', 'KTE'], ['Khandwa Junction', 'Khandwa', 'KNW'], ['Burhanpur', 'Burhanpur', 'BAU'], ['Chhindwara Junction', 'Chhindwara', 'CWA'], ['Mandsaur', 'Mandsaur'], ['Neemuch', 'Neemuch', 'NMH'], ['Shahdol', 'Shahdol', 'SDL'], ['Singrauli', 'Singrauli', 'SGRL'], ['Vidisha', 'Vidisha', 'BHS'], ['Narmadapuram', 'Narmadapuram', 'NDPM']]],
  ['Maharashtra', 'Mumbai Central', [['CSMT', 'Mumbai', 'CSMT'], ['Mumbai Central', 'Mumbai', 'MMCT'], ['Dadar Central', 'Mumbai', 'DR'], ['Bandra Terminus', 'Mumbai', 'BDTS'], ['Pune Junction', 'Pune', 'PUNE'], ['Nagpur Junction', 'Nagpur', 'NGP'], ['Nashik Road', 'Nashik', 'NK'], ['Chhatrapati Sambhajinagar', 'Chhatrapati Sambhajinagar', 'AWB'], ['Solapur', 'Solapur', 'SUR'], ['Kolhapur SCSMT', 'Kolhapur', 'KOP'], ['Amravati', 'Amravati', 'AMI'], ['Akola Junction', 'Akola', 'AK'], ['Nanded', 'Nanded', 'NED'], ['Jalgaon Junction', 'Jalgaon', 'JL'], ['Manmad Junction', 'Manmad', 'MMR'], ['Latur', 'Latur', 'LUR'], ['Wardha Junction', 'Wardha', 'WR'], ['Chandrapur', 'Chandrapur', 'CD'], ['Bhusaval Junction', 'Bhusaval', 'BSL'], ['Panvel', 'Panvel', 'PNVL'], ['Thane', 'Thane', 'TNA'], ['Kalyan Junction', 'Kalyan', 'KYN'], ['Miraj Junction', 'Miraj', 'MRJ'], ['Sangli', 'Sangli', 'SLI'], ['Parbhani Junction', 'Parbhani', 'PBN'], ['Jalna', 'Jalna', 'J'], ['Ratnagiri', 'Ratnagiri', 'RN'], ['Lonavala', 'Lonavala', 'LNL'], ['Ahmednagar', 'Ahmednagar', 'ANG'], ['Gondia Junction', 'Gondia', 'G'], ['Badnera Junction', 'Amravati', 'BD']]],
  ['Manipur', 'Guwahati', [['Jiribam', 'Jiribam', 'JRBM'], ['Khongsang', 'Khongsang', 'KGBP'], ['Noney', 'Noney']]],
  ['Meghalaya', 'Guwahati', [['Mendipathar', 'Mendipathar', 'MNDP']]],
  ['Mizoram', 'Guwahati', [['Sairang', 'Aizawl', 'SANG'], ['Bairabi', 'Bairabi', 'BRBI']]],
  ['Nagaland', 'Guwahati', [['Dimapur', 'Dimapur', 'DMV']]],
  ['Odisha', 'Bhubaneswar', [['Bhubaneswar', 'Bhubaneswar', 'BBS'], ['Cuttack', 'Cuttack', 'CTC'], ['Puri', 'Puri', 'PURI'], ['Sambalpur Junction', 'Sambalpur', 'SBP'], ['Rourkela', 'Rourkela', 'ROU'], ['Brahmapur', 'Brahmapur', 'BAM'], ['Balasore', 'Balasore', 'BLS'], ['Jharsuguda Junction', 'Jharsuguda', 'JSG'], ['Angul', 'Angul', 'ANGL'], ['Talcher Road', 'Talcher', 'TLHD'], ['Bhadrak', 'Bhadrak', 'BHC'], ['Rayagada', 'Rayagada', 'RGDA'], ['Koraput Junction', 'Koraput', 'KRPU'], ['Khurda Road Junction', 'Khurda', 'KUR'], ['Baripada', 'Baripada', 'BPO'], ['Jajpur Keonjhar Road', 'Jajpur', 'JJKR'], ['Balangir', 'Balangir', 'BLGR'], ['Titlagarh Junction', 'Titlagarh', 'TIG'], ['Dhenkanal', 'Dhenkanal', 'DNKL']]],
  ['Punjab', 'Amritsar', [['Amritsar Junction', 'Amritsar', 'ASR'], ['Ludhiana Junction', 'Ludhiana', 'LDH'], ['Jalandhar City', 'Jalandhar', 'JUC'], ['Pathankot Junction', 'Pathankot', 'PTK'], ['Patiala', 'Patiala', 'PTA'], ['Bathinda Junction', 'Bathinda', 'BTI'], ['Firozpur Cantt', 'Firozpur', 'FZR'], ['Hoshiarpur', 'Hoshiarpur', 'HSX'], ['Phagwara Junction', 'Phagwara', 'PGW'], ['Gurdaspur', 'Gurdaspur', 'GSP'], ['Anandpur Sahib', 'Anandpur Sahib', 'ANSB'], ['Dhilwan', 'Dhilwan', 'DIW']]],
  ['Rajasthan', 'Jaipur', [['Jaipur Junction', 'Jaipur', 'JP'], ['Jodhpur Junction', 'Jodhpur', 'JU'], ['Udaipur City', 'Udaipur', 'UDZ'], ['Ajmer Junction', 'Ajmer', 'AII'], ['Kota Junction', 'Kota', 'KOTA'], ['Bikaner Junction', 'Bikaner', 'BKN'], ['Jaisalmer', 'Jaisalmer', 'JSM'], ['Bhilwara', 'Bhilwara', 'BHL'], ['Alwar Junction', 'Alwar', 'AWR'], ['Sawai Madhopur Junction', 'Sawai Madhopur', 'SWM'], ['Bharatpur Junction', 'Bharatpur', 'BTE'], ['Abu Road', 'Abu Road', 'ABR'], ['Chittaurgarh', 'Chittaurgarh', 'COR'], ['Sikar Junction', 'Sikar', 'SIKR'], ['Sri Ganganagar Junction', 'Sri Ganganagar', 'SGNR'], ['Barmer', 'Barmer', 'BME'], ['Falna', 'Falna', 'FA'], ['Makrana Junction', 'Makrana', 'ＭＫＮ']]],
  ['Sikkim', 'New Jalpaiguri', []],
  ['Tamil Nadu', 'Chennai Central', [['Chennai Central', 'Chennai', 'MAS'], ['Chennai Egmore', 'Chennai', 'MS'], ['Coimbatore Junction', 'Coimbatore', 'CBE'], ['Madurai Junction', 'Madurai', 'MDU'], ['Tiruchchirappalli Junction', 'Tiruchirappalli', 'TPJ'], ['Salem Junction', 'Salem', 'SA'], ['Tirunelveli Junction', 'Tirunelveli', 'TEN'], ['Erode Junction', 'Erode', 'ED'], ['Katpadi Junction', 'Vellore', 'KPD'], ['Thanjavur Junction', 'Thanjavur', 'TJ'], ['Dindigul Junction', 'Dindigul', 'DG'], ['Nagercoil Junction', 'Nagercoil', 'NCJ'], ['Thoothukudi', 'Thoothukudi', 'TN'], ['Tiruppur', 'Tiruppur', 'TUP'], ['Kanchipuram', 'Kanchipuram', 'CJ'], ['Villupuram Junction', 'Villupuram', 'VM'], ['Rameswaram', 'Rameswaram', 'RMM'], ['Karaikudi Junction', 'Karaikudi', 'KKDI'], ['Chengalpattu Junction', 'Chengalpattu', 'CGL'], ['Cuddalore Port Junction', 'Cuddalore', 'CUPJ'], ['Pollachi Junction', 'Pollachi', 'POY'], ['Mayiladuthurai Junction', 'Mayiladuthurai', 'MV'], ['Tiruvannamalai', 'Tiruvannamalai', 'TNM'], ['Udagamandalam', 'Ooty', 'UAM']]],
  ['Telangana', 'Secunderabad', [['Secunderabad Junction', 'Hyderabad', 'SC'], ['Hyderabad Deccan', 'Hyderabad', 'HYB'], ['Kacheguda', 'Hyderabad', 'KCG'], ['Warangal', 'Warangal', 'WL'], ['Nizamabad Junction', 'Nizamabad', 'NZB'], ['Khammam', 'Khammam', 'KMT'], ['Karimnagar', 'Karimnagar', 'KRMR'], ['Mahbubnagar', 'Mahbubnagar', 'MBNR'], ['Ramagundam', 'Ramagundam', 'RDM'], ['Adilabad', 'Adilabad', 'ADB'], ['Kazipet Junction', 'Kazipet', 'KZJ'], ['Mancherial', 'Mancherial', 'MCI'], ['Suryapet', 'Suryapet']]],
  ['Tripura', 'Guwahati', [['Agartala', 'Agartala', 'AGTL'], ['Dharmanagar', 'Dharmanagar', 'DMR'], ['Kumarghat', 'Kumarghat', 'KUGT'], ['Udaipur Tripura', 'Udaipur', 'UDPU']]],
  ['Uttar Pradesh', 'Lucknow', [['Lucknow Charbagh', 'Lucknow', 'LKO'], ['Kanpur Central', 'Kanpur', 'CNB'], ['Agra Cantt', 'Agra', 'AGC'], ['Varanasi Junction', 'Varanasi', 'BSB'], ['Prayagraj Junction', 'Prayagraj', 'PRYJ'], ['Gorakhpur Junction', 'Gorakhpur', 'GKP'], ['Bareilly Junction', 'Bareilly', 'BE'], ['Jhansi Junction', 'Jhansi', 'VGLJ'], ['Mathura Junction', 'Mathura', 'MTJ'], ['Ayodhya Cantt', 'Ayodhya', 'AYC'], ['Deen Dayal Upadhyaya Junction', 'Pt. Deen Dayal Upadhyaya Nagar', 'DDU'], ['Moradabad Junction', 'Moradabad', 'MB'], ['Aligarh Junction', 'Aligarh', 'ALJN'], ['Meerut City', 'Meerut', 'MTC'], ['Gonda Junction', 'Gonda', 'GD'], ['Farrukhabad Junction', 'Farrukhabad', 'FBD'], ['Tundla Junction', 'Tundla', 'TDL'], ['Etawah Junction', 'Etawah', 'ETW'], ['Shahjahanpur', 'Shahjahanpur', 'SPN'], ['Sultanpur Junction', 'Sultanpur', 'SLN'], ['Mirzapur', 'Mirzapur', 'MZP'], ['Ballia', 'Ballia', 'BUI'], ['Fatehpur', 'Fatehpur', 'FTP'], ['Rae Bareli Junction', 'Rae Bareli', 'RBL'], ['Sitapur Junction', 'Sitapur', 'STP'], ['Basti', 'Basti', 'BST'], ['Azamgarh', 'Azamgarh', 'AMH'], ['Mau Junction', 'Mau', 'MAU'], ['Unnao Junction', 'Unnao', 'ON'], ['Orai', 'Orai', 'ORAI'], ['Lalitpur', 'Lalitpur', 'LAR'], ['Kasganj Junction', 'Kasganj', 'KSJ'], ['Saharanpur Junction', 'Saharanpur', 'SRE']]],
  ['Uttarakhand', 'Dehradun', [['Dehradun', 'Dehradun', 'DDN'], ['Haridwar Junction', 'Haridwar', 'HW'], ['Kathgodam', 'Haldwani', 'KGM'], ['Rishikesh', 'Rishikesh', 'RKSH'], ['Kashipur', 'Kashipur', 'KPV'], ['Rudrapur City', 'Rudrapur', 'RUPC'], ['Roorkee', 'Roorkee', 'RK'], ['Kotdwar', 'Kotdwar', 'KTW'], ['Ramnagar', 'Ramnagar', 'RMR']]],
  ['West Bengal', 'Kolkata', [['Howrah Junction', 'Kolkata', 'HWH'], ['Sealdah', 'Kolkata', 'SDAH'], ['Kolkata', 'Kolkata', 'KOAA'], ['New Jalpaiguri', 'Siliguri', 'NJP'], ['Asansol Junction', 'Asansol', 'ASN'], ['Durgapur', 'Durgapur', 'DGR'], ['Malda Town', 'Malda', 'MLDT'], ['Kharagpur Junction', 'Kharagpur', 'KGP'], ['Siliguri Junction', 'Siliguri', 'SGUJ'], ['Barddhaman Junction', 'Bardhaman', 'BWN'], ['Jalpaiguri Road', 'Jalpaiguri', 'JPE'], ['Haldia', 'Haldia', 'HLZ'], ['Balurghat', 'Balurghat', 'BLGT'], ['Cooch Behar', 'Cooch Behar', 'COB'], ['Rampurhat Junction', 'Rampurhat', 'RPH'], ['Bangaon Junction', 'Bangaon', 'BNJ'], ['Krishnanagar City Junction', 'Krishnanagar', 'KNJ'], ['Bankura', 'Bankura', 'BQA'], ['Purulia Junction', 'Purulia', 'PRR'], ['Kalyani', 'Kalyani', 'KYI'], ['Shalimar', 'Howrah', 'SHM'], ['New Cooch Behar', 'Cooch Behar', 'NCB']]],
  ['Delhi', 'New Delhi', [['New Delhi', 'Delhi', 'NDLS'], ['Old Delhi', 'Delhi', 'DLI'], ['Hazrat Nizamuddin', 'Delhi', 'NZM'], ['Anand Vihar Terminal', 'Delhi', 'ANVT'], ['Delhi Cantt', 'Delhi', 'DEC'], ['Delhi Sarai Rohilla', 'Delhi', 'DEE'], ['Delhi Shahdara', 'Delhi', 'DSA']]],
  ['Jammu and Kashmir', 'Jammu Tawi', [['Jammu Tawi', 'Jammu', 'JAT'], ['Srinagar', 'Srinagar', 'SINA'], ['Banihal', 'Banihal', 'BAHL'], ['Katra', 'Katra', 'SVDK'], ['Anantnag', 'Anantnag', 'ANT'], ['Baramulla', 'Baramulla', 'BRML'], ['Awantipora', 'Awantipora', 'ATPA'], ['Sangaldan', 'Sangaldan', 'SGDN']]],
  ['Ladakh', 'New Delhi', []],
  ['Chandigarh', 'Chandigarh', [['Chandigarh', 'Chandigarh', 'CDG']]],
  ['Puducherry', 'Chennai Central', [['Puducherry', 'Puducherry', 'PDY'], ['Karaikal', 'Karaikal', 'KIK'], ['Mahe', 'Mahe', 'MAHE']]],
]

const idOverrides: Record<string, string> = { 'New Delhi': 'NDLS', 'Agra Cantt': 'AGC', 'Jaipur Junction': 'JP', 'Bhopal Junction': 'BPL', 'Mumbai Central': 'MMCT', 'Lucknow Charbagh': 'LKO', 'Kanpur Central': 'CNB' }
const verifiedCodes = new Set(['AGC', 'ADI', 'ALLP', 'ANVT', 'ATP', 'ASR', 'ASN', 'BAY', 'BDTS', 'BBS', 'BLS', 'BLGR', 'BPL', 'CBE', 'CDG', 'CSMT', 'CTC', 'MAS', 'MS', 'NDLS', 'SBC', 'UMB'])
const hubStationNames: Record<string, string> = {
  Vijayawada: 'Vijayawada Junction', Guwahati: 'Guwahati', Patna: 'Patna Junction', Raipur: 'Raipur Junction', Ahmedabad: 'Ahmedabad Junction',
  'New Delhi': 'New Delhi', Chandigarh: 'Chandigarh', Ranchi: 'Ranchi Junction', Bengaluru: 'KSR Bengaluru City',
  'Ernakulam Junction': 'Ernakulam Junction', Bhopal: 'Bhopal Junction', 'Mumbai Central': 'Mumbai Central',
  'Bhubaneswar': 'Bhubaneswar', Amritsar: 'Amritsar Junction', Jaipur: 'Jaipur Junction', 'New Jalpaiguri': 'New Jalpaiguri',
  'Chennai Central': 'Chennai Central', Secunderabad: 'Secunderabad Junction', Lucknow: 'Lucknow Charbagh', Kolkata: 'Howrah Junction', 'Jammu Tawi': 'Jammu Tawi',
}
const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()
const baseStations = regions.flatMap(([stateOrUT, , entries]) => entries.map(([name, city, code]) => {
  const id = idOverrides[name] ?? `IN-${slug(stateOrUT)}-${slug(name)}`
  const normalizedCode = code?.trim() ?? ''
  return { id, name, city, stateOrUT, code: verifiedCodes.has(normalizedCode) ? normalizedCode : '' }
}))
export function validateStationCatalogue(records: readonly Station[]): void {
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const station of records) {
    const nameKey = (station.stateOrUT ?? '') + ':' + station.name.toLocaleLowerCase('en-IN')
    if (ids.has(station.id)) throw new Error(`Duplicate station ID: ${station.id}`)
    if (names.has(nameKey)) throw new Error(`Duplicate station name in territory: ${nameKey}`)
    ids.add(station.id)
    names.add(nameKey)
  }
}
validateStationCatalogue(baseStations)
export const stations: Station[] = baseStations.map((station) => {
  const hubName = regions.find(([territory]) => territory === station.stateOrUT)?.[1] ?? 'New Delhi'
  const hubStation = hubStationNames[hubName]
  const resolvedHub = baseStations.find((candidate) => candidate.name === hubStation)
  return { ...station, networkHubId: station.name === hubStation ? station.id : resolvedHub?.id ?? 'NDLS' }
})

export const territoryCoverage = [
  ...regions.map(([name]) => ({ name, catalogueEntries: stations.filter((station) => station.stateOrUT === name).length })),
  { name: 'Andaman and Nicobar Islands', catalogueEntries: 0 },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', catalogueEntries: 0 },
  { name: 'Lakshadweep', catalogueEntries: 0 },
] as const

/** Search station name, served city, state/UT and verified code. */
export function searchStations(query: string, limit = 20, excludeId?: string): Station[] {
  const terms = query.trim().toLocaleLowerCase('en-IN').split(/\s+/).filter(Boolean)
  const available = stations.filter((station) => station.id !== excludeId)
  if (!terms.length) return available.slice(0, limit)
  return available.map((station) => {
    const searchable = [station.name, station.city, station.stateOrUT ?? '', station.code].map((part) => part.toLocaleLowerCase('en-IN'))
    if (!terms.every((term) => searchable.some((part) => part.includes(term)))) return { station, score: -1 }
    const score = terms.reduce((total, term) => total + (searchable[0]!.startsWith(term) || searchable[3] === term ? 4 : searchable[0]!.includes(term) ? 3 : searchable[1]!.includes(term) ? 2 : 1), 0)
    return { station, score }
  }).filter((item) => item.score >= 0).sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name)).slice(0, limit).map(({ station }) => station)
}
