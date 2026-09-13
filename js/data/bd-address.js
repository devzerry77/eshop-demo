// ─── BANGLADESH ADMINISTRATIVE LOCATIONS ───────────────────
// 8 divisions → 64 districts → common areas / thanas.
// Used for Daraz-style chained address selectors.

export const BD_DIVISIONS = [
    {
        name: 'Dhaka',
        districts: [
            { name: 'Dhaka', areas: ['Mirpur', 'Uttara', 'Gulshan', 'Banani', 'Dhanmondi', 'Mohammadpur', 'Motijheel', 'Tejgaon', 'Farmgate', 'Shahbagh', 'Paltan', 'Lalbagh', 'Ramna', 'Badda', 'Rampura', 'Hazaribagh', 'Jatrabari', 'Kadamtali', 'Demra', 'Savar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj'] },
            { name: 'Faridpur', areas: ['Faridpur Sadar', 'Alfadanga', 'Bhanga', 'Boalmari', 'Charbhadrasan', 'Madhukhali', 'Nagarkanda', 'Sadarpur', 'Saltha'] },
            { name: 'Gazipur', areas: ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Tongi'] },
            { name: 'Gopalganj', areas: ['Gopalganj Sadar', 'Kashiani', 'Kotalipara', 'Muksudpur', 'Tungipara'] },
            { name: 'Kishoreganj', areas: ['Kishoreganj Sadar', 'Austagram', 'Bajitpur', 'Bhairab', 'Hossainpur', 'Itna', 'Karimganj', 'Katiadi', 'Kuliarchar', 'Mithamain', 'Nikli', 'Pakundia', 'Tarail'] },
            { name: 'Madaripur', areas: ['Madaripur Sadar', 'Kalkini', 'Rajoir', 'Shibchar'] },
            { name: 'Manikganj', areas: ['Manikganj Sadar', 'Daulatpur', 'Ghior', 'Harirampur', 'Saturia', 'Shibalaya', 'Singair'] },
            { name: 'Munshiganj', areas: ['Munshiganj Sadar', 'Gazaria', 'Lohajang', 'Sirajdikhan', 'Sreenagar', 'Tongibari'] },
            { name: 'Narayanganj', areas: ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'] },
            { name: 'Narsingdi', areas: ['Narsingdi Sadar', 'Belabo', 'Monohardi', 'Palash', 'Raipura', 'Shibpur'] },
            { name: 'Rajbari', areas: ['Rajbari Sadar', 'Baliakandi', 'Goalandaghat', 'Kalukhali', 'Pangsha'] },
            { name: 'Shariatpur', areas: ['Shariatpur Sadar', 'Bhedarganj', 'Damudya', 'Gosairhat', 'Naria', 'Zajira'] },
            { name: 'Tangail', areas: ['Tangail Sadar', 'Basail', 'Bhuapur', 'Delduar', 'Dhanbari', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Mirzapur', 'Nagarpur', 'Sakhipur'] }
        ]
    },
    {
        name: 'Chittagong',
        districts: [
            { name: 'Chattogram', areas: ['Chattogram City', 'Agrabad', 'Halishahar', 'Pahartali', 'Khulshi', 'Panchlaish', 'Chandgaon', 'Double Mooring', 'Bakolia', 'Kotwali', 'Patiya', 'Boalkhali', 'Fatikchhari', 'Hathazari', 'Mirsharai', 'Raozan', 'Rangunia', 'Sandwip', 'Satkania', 'Sitakunda'] },
            { name: "Cox's Bazar", areas: ["Cox's Bazar Sadar", 'Chakaria', 'Maheshkhali', 'Kutubdia', 'Ramu', 'Teknaf', 'Ukhia', 'Pekua'] },
            { name: 'Bandarban', areas: ['Bandarban Sadar', 'Alikadam', 'Lama', 'Naikhongchhari', 'Rowangchhari', 'Ruma', 'Thanchi'] },
            { name: 'Brahmanbaria', areas: ['Brahmanbaria Sadar', 'Ashuganj', 'Akhaura', 'Bancharampur', 'Bijoynagar', 'Kasba', 'Nabinagar', 'Nasirnagar', 'Sarail'] },
            { name: 'Chandpur', areas: ['Chandpur Sadar', 'Faridganj', 'Hajiganj', 'Haimchar', 'Kachua', 'Matlab Uttar', 'Matlab Dakshin', 'Shahrasti'] },
            { name: 'Cumilla', areas: ['Cumilla City', 'Cumilla Sadar', 'Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Daudkandi', 'Debidwar', 'Homna', 'Laksam', 'Muradnagar', 'Nangalkot'] },
            { name: 'Feni', areas: ['Feni Sadar', 'Chhagalnaiya', 'Daganbhuiyan', 'Fulgazi', 'Parshuram', 'Sonagazi'] },
            { name: 'Khagrachhari', areas: ['Khagrachhari Sadar', 'Dighinala', 'Lakshmichhari', 'Mahalchhari', 'Manikchhari', 'Matiranga', 'Panchhari', 'Ramgarh'] },
            { name: 'Lakshmipur', areas: ['Lakshmipur Sadar', 'Kamalnagar', 'Ramganj', 'Ramgati', 'Raipur'] },
            { name: 'Noakhali', areas: ['Noakhali Sadar', 'Begumganj', 'Chatkhil', 'Companiganj', 'Hatiya', 'Kabirhat', 'Senbagh', 'Sonaimuri', 'Subarnachar'] },
            { name: 'Rangamati', areas: ['Rangamati Sadar', 'Bagaichhari', 'Barkal', 'Belai Chhari', 'Juraichhari', 'Kaptai', 'Kawkhali', 'Langadu', 'Naniarchar', 'Rajasthali'] }
        ]
    },
    {
        name: 'Rajshahi',
        districts: [
            { name: 'Rajshahi', areas: ['Rajshahi City', 'Rajshahi Sadar', 'Bagha', 'Bagmara', 'Charghat', 'Durgapur', 'Godagari', 'Mohanpur', 'Paba', 'Puthia', 'Tanore'] },
            { name: 'Bogura', areas: ['Bogura City', 'Bogura Sadar', 'Adamdighi', 'Dhunat', 'Dhupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakandi', 'Shibganj', 'Sherpur'] },
            { name: 'Joypurhat', areas: ['Joypurhat Sadar', 'Akkelpur', 'Kalai', 'Khetlal', 'Pachbibi'] },
            { name: 'Naogaon', areas: ['Naogaon Sadar', 'Atrai', 'Badalgachhi', 'Dhamoirhat', 'Manda', 'Mahadebpur', 'Niamatpur', 'Patnitala', 'Porsha', 'Raninagar'] },
            { name: 'Natore', areas: ['Natore Sadar', 'Bagatipara', 'Baraigram', 'Gurudaspur', 'Lalpur', 'Naldanga', 'Singra'] },
            { name: 'Chapainawabganj', areas: ['Chapainawabganj Sadar', 'Bholahat', 'Gomastapur', 'Nachole', 'Shibganj'] },
            { name: 'Pabna', areas: ['Pabna Sadar', 'Atgharia', 'Bera', 'Bhangura', 'Chatmohar', 'Faridpur', 'Ishwardi', 'Santhia', 'Sujanagar'] },
            { name: 'Sirajganj', areas: ['Sirajganj Sadar', 'Belkuchi', 'Chauhali', 'Kamarkhanda', 'Kazipur', 'Raiganj', 'Shahjadpur', 'Tarash', 'Ullahpara'] }
        ]
    },
    {
        name: 'Khulna',
        districts: [
            { name: 'Khulna', areas: ['Khulna City', 'Khulna Sadar', 'Batiaghata', 'Dacope', 'Dighalia', 'Dumuria', 'Koyra', 'Paikgachha', 'Phultala', 'Rupsha', 'Terokhada'] },
            { name: 'Bagerhat', areas: ['Bagerhat Sadar', 'Chitalmari', 'Fakirhat', 'Kachua', 'Mollahat', 'Mongla', 'Morrelganj', 'Rampal', 'Sarankhola'] },
            { name: 'Chuadanga', areas: ['Chuadanga Sadar', 'Alamdanga', 'Damurhuda', 'Jibannagar'] },
            { name: 'Jashore', areas: ['Jashore Sadar', 'Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha'] },
            { name: 'Jhenaidah', areas: ['Jhenaidah Sadar', 'Harinakunda', 'Kaliganj', 'Kotchandpur', 'Maheshpur', 'Shailkupa'] },
            { name: 'Kushtia', areas: ['Kushtia Sadar', 'Bheramara', 'Daulatpur', 'Khoksa', 'Kumarkhali', 'Mirpur'] },
            { name: 'Magura', areas: ['Magura Sadar', 'Mohammadpur', 'Shalikha', 'Sreepur'] },
            { name: 'Meherpur', areas: ['Meherpur Sadar', 'Gangni', 'Mujibnagar'] },
            { name: 'Narail', areas: ['Narail Sadar', 'Kalia', 'Lohagara'] },
            { name: 'Satkhira', areas: ['Satkhira Sadar', 'Assasuni', 'Debhata', 'Kalaroa', 'Kaliganj', 'Shyamnagar', 'Tala'] }
        ]
    },
    {
        name: 'Barisal',
        districts: [
            { name: 'Barisal', areas: ['Barisal Sadar', 'Babuganj', 'Bakerganj', 'Banaripara', 'Gournadi', 'Hizla', 'Mehendiganj', 'Muladi', 'Wazirpur'] },
            { name: 'Barguna', areas: ['Barguna Sadar', 'Amtali', 'Bamna', 'Betagi', 'Patharghata', 'Taltali'] },
            { name: 'Bhola', areas: ['Bhola Sadar', 'Borhanuddin', 'Char Fasson', 'Daulatkhan', 'Lalmohan', 'Manpura', 'Tazumuddin'] },
            { name: 'Jhalokati', areas: ['Jhalokati Sadar', 'Kathalia', 'Nalchity', 'Rajapur'] },
            { name: 'Patuakhali', areas: ['Patuakhali Sadar', 'Bauphal', 'Dashmina', 'Dumki', 'Galachipa', 'Kalapara', 'Mirzaganj', 'Rangabali'] },
            { name: 'Pirojpur', areas: ['Pirojpur Sadar', 'Bhandaria', 'Kawkhali', 'Mathbaria', 'Nazirpur', 'Nesarabad', 'Zianagar'] }
        ]
    },
    {
        name: 'Sylhet',
        districts: [
            { name: 'Sylhet', areas: ['Sylhet City', 'Sylhet Sadar', 'Balaganj', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Zakiganj', 'Osmaninagar'] },
            { name: 'Habiganj', areas: ['Habiganj Sadar', 'Ajmiriganj', 'Bahubal', 'Baniachong', 'Chunarughat', 'Lakhai', 'Madhabpur', 'Nabiganj'] },
            { name: 'Moulvibazar', areas: ['Moulvibazar Sadar', 'Barlekha', 'Juri', 'Kamalganj', 'Kulaura', 'Rajnagar', 'Sreemangal'] },
            { name: 'Sunamganj', areas: ['Sunamganj Sadar', 'Bishwamvarpur', 'Chhatak', 'Derai', 'Dharamapasha', 'Dowarabazar', 'Jagannathpur', 'Jamalganj', 'Shalla', 'Tahirpur'] }
        ]
    },
    {
        name: 'Rangpur',
        districts: [
            { name: 'Rangpur', areas: ['Rangpur City', 'Rangpur Sadar', 'Badarganj', 'Gangachara', 'Kaunia', 'Mithapukur', 'Pirgachha', 'Pirganj', 'Taraganj'] },
            { name: 'Dinajpur', areas: ['Dinajpur Sadar', 'Birampur', 'Birganj', 'Biral', 'Bochaganj', 'Chirirbandar', 'Fulbari', 'Ghoraghat', 'Hakimpur', 'Kaharole', 'Khansama', 'Nawabganj', 'Parbatipur'] },
            { name: 'Gaibandha', areas: ['Gaibandha Sadar', 'Fulchhari', 'Gobindaganj', 'Palashbari', 'Sadullapur', 'Saghata', 'Sundarganj'] },
            { name: 'Kurigram', areas: ['Kurigram Sadar', 'Bhurungamari', 'Char Rajibpur', 'Chilmari', 'Nageshwari', 'Phulbari', 'Rajibpur', 'Roumari', 'Ulipur'] },
            { name: 'Lalmonirhat', areas: ['Lalmonirhat Sadar', 'Aditmari', 'Hatibandha', 'Kaliganj', 'Patgram'] },
            { name: 'Nilphamari', areas: ['Nilphamari Sadar', 'Dimla', 'Domar', 'Jaldhaka', 'Kishoreganj', 'Saidpur'] },
            { name: 'Panchagarh', areas: ['Panchagarh Sadar', 'Atwari', 'Boda', 'Debiganj', 'Tetulia'] },
            { name: 'Thakurgaon', areas: ['Thakurgaon Sadar', 'Baliadangi', 'Haripur', 'Pirganj', 'Ranisankail'] }
        ]
    },
    {
        name: 'Mymensingh',
        districts: [
            { name: 'Mymensingh', areas: ['Mymensingh City', 'Mymensingh Sadar', 'Bhaluka', 'Dhobaura', 'Fulbaria', 'Gaffargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Nandail', 'Phulpur', 'Trishal', 'Tarakanda'] },
            { name: 'Jamalpur', areas: ['Jamalpur Sadar', 'Bakshiganj', 'Dewanganj', 'Islampur', 'Madarganj', 'Melandaha', 'Sarishabari'] },
            { name: 'Netrokona', areas: ['Netrokona Sadar', 'Atpara', 'Barhatta', 'Durgapur', 'Kalmakanda', 'Kendua', 'Khaliajuri', 'Madan', 'Mohanganj', 'Purbadhala'] },
            { name: 'Sherpur', areas: ['Sherpur Sadar', 'Jhenaigati', 'Nalitabari', 'Nakla', 'Sreebardi'] }
        ]
    }
];