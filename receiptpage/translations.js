const translations = {
    en: {
        // Receipt specific
        'receiptInvoice': 'RECEIPT • INVOICE',
        'scanToVerify': 'Scan to verify',
        'advancePayment': 'Advance Payment',
        'amountPaid': 'Amount Paid',
        'balanceDue': 'Balance Due',
        'thankYou': 'Thank you for your business!',
        'pleaseComeAgain': 'Please Come Again',
        'computerGenerated': 'This is a computer-generated document.',
        'printReceipt': 'Print Receipt',
        'downloadPdf': 'Download PDF',
        'pdfPreparing': 'Preparing PDF...',
        'pdfDownloadSuccess': 'Receipt PDF downloaded.',
        'pdfDownloadFailed': 'Could not create the receipt PDF. Please try again.',
        'receiptInstallTitle': 'Install StocksalesApp',
        'receiptInstallMessage': 'Install the app for quicker access to your shop tools.',
        'installApp': 'Install app',
        'openMicrosoftStore': 'Get it from Microsoft Store',
        'mobileInstallInstructionsIOS': 'Tap Share, then choose Add to Home Screen to install.',
        'mobileInstallInstructions': 'Open your browser menu and choose Install app or Add to Home Screen.',
        'installPromptFailed': 'Could not open the install prompt. Please use your browser menu.',
        'close': 'Close',
        'receiptLinkCopied': 'Receipt link copied!',
        'receiptLinkShared': 'Receipt link copied! Share it to view this receipt.',
        'receiptLinkCopyFailed': 'Failed to copy link. Please copy manually.',
        'receiptModalUnavailable': 'Receipt details are unavailable.',
        'receiptLoadError': 'Could not display the receipt. Please try again.',
        'shareReceipt': 'Share Receipt',
        'guarantee': 'Guarantee',
        'validUntil': 'Valid until',
        'product': 'Product',
        'service': 'Service',
        'customer': 'Customer',
        'customerPhone': 'Customer Phone',
        'yourBusinessName': 'Your Business Name',
        'theCashier': 'Cashier',
        'tel': 'Tel',
        'tel2': 'Tel 2',
        'defaultGuaranteeText': 'This product is guaranteed for ${warrantyPeriod}',
        'receiptNotFound': 'Receipt Not Found',
        'receiptNotFoundDesc': "The receipt you're looking for doesn't exist or has been removed.",
        'enterReceiptId': 'Enter Receipt ID (e.g., CR-283059)',
        'searchReceipt': 'Search Receipt',
        'createShopNow': 'Create your shop now',
        'loadingReceipt': 'Loading receipt...',
        'subtotal': 'Subtotal',
        'total': 'Total',
        'tax': 'Tax',
        'tableItem': 'Item',
        'tableType': 'Type',
        'tableQty': 'Qty',
        'tableUnitPrice': 'Unit Price',
        'tableSubtotal': 'Subtotal',
        'toBePaidOn': 'to be paid on',
        'validUntil': 'Valid until',
        'noRefundAfterPayment': 'no refund after payment and testing',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 Happy Holidays!',
        'happyNewYear': '🎉 Happy New Year!',
        'merryChristmas': '🎄 Merry Christmas!',
        'eidMubarak': '🌙 Eid Mubarak!',
        'happyDiwali': '🪔 Happy Diwali!',
        'itemsSingular': 'item',
        'itemsPlural': 'items',
        'andMore': 'and {count} more',
        'forCustomer': 'For: {name}',
        
        // Badges
        'off': 'Off',
        'independenceDay': 'Independence Day',
        'laborDay': 'Labor Day',
        'veteransDay': 'Veterans Day',
        'remembranceDay': 'Remembrance Day',
        'republicDay': 'Republic Day',
        'constitutionDay': 'Constitution Day',
        'victoryDay': 'Victory Day',
        'unityDay': 'Unity Day',
        'bankHoliday': 'Bank Holiday',
        'newYearsDay': "New Year's Day",
        'lunarNewYear': 'Lunar New Year',
        'springFestival': 'Spring Festival',
        'christmasDay': 'Christmas Day',
        'eidAlFitr': 'Eid al-Fitr',
        'eidAlAdha': 'Eid al-Adha',
        'diwali': 'Diwali',
        'easterSunday': 'Easter Sunday',
        'hanukkah': 'Hanukkah',
        'vesakDay': 'Vesak Day',
        'epiphany': 'Epiphany',
        'thanksgiving': 'Thanksgiving',
        'halloween': 'Halloween',
        'carnival': 'Carnival',
        'midsummer': 'Midsummer',
        'stPatricksDay': "St. Patrick's Day",
        'womensDay': "International Women's Day",
        'childrensDay': "Children's Day",
        'earthDay': 'Earth Day',
        'peaceDay': 'Peace Day',
        'prideMonth': 'Pride Month',
        'boxingDay': 'Boxing Day',
        'bastilleDay': 'Bastille Day',
        'canadaDay': 'Canada Day',
        'anzacDay': 'ANZAC Day',
        'kingsDay': "King's Day",
        'mayDay': 'May Day',
        'allSaintsDay': "All Saints' Day",
        'nationalDay': 'National Day',
        'familyDay': 'Family Day',
        'youthDay': 'Youth Day',
        'none': 'None'
    },
    
    fr: {
        // Receipt specific
        'receiptInvoice': 'REÇU • FACTURE',
        'scanToVerify': 'Scanner pour vérifier',
        'advancePayment': 'Paiement anticipé',
        'amountPaid': 'Montant payé',
        'balanceDue': 'Solde dû',
        'thankYou': 'Merci pour votre confiance !',
        'pleaseComeAgain': 'Revenez bientôt',
        'computerGenerated': 'Ceci est un document généré par ordinateur.',
        'printReceipt': 'Imprimer le reçu',
        'downloadPdf': 'Télécharger PDF',
        'pdfPreparing': 'Préparation du PDF...',
        'pdfDownloadSuccess': 'Le PDF du reçu a été téléchargé.',
        'pdfDownloadFailed': 'Impossible de créer le PDF du reçu. Veuillez réessayer.',
        'receiptInstallTitle': 'Installer StocksalesApp',
        'receiptInstallMessage': 'Installez l’application pour accéder plus rapidement aux outils de votre boutique.',
        'installApp': 'Installer l’application',
        'openMicrosoftStore': 'Obtenir sur Microsoft Store',
        'mobileInstallInstructionsIOS': 'Touchez Partager, puis Ajouter à l’écran d’accueil pour installer.',
        'mobileInstallInstructions': 'Ouvrez le menu du navigateur et choisissez Installer l’application ou Ajouter à l’écran d’accueil.',
        'installPromptFailed': 'Impossible d’ouvrir l’installation. Utilisez le menu de votre navigateur.',
        'close': 'Fermer',
        'receiptLinkCopied': 'Lien du reçu copié !',
        'receiptLinkShared': 'Lien du reçu copié ! Partagez-le pour afficher ce reçu.',
        'receiptLinkCopyFailed': 'Impossible de copier le lien. Veuillez le copier manuellement.',
        'receiptModalUnavailable': 'Les détails du reçu sont indisponibles.',
        'receiptLoadError': 'Impossible d’afficher le reçu. Veuillez réessayer.',
        'shareReceipt': 'Partager le reçu',
        'guarantee': 'Garantie',
        'validUntil': 'Valable jusqu\'au',
        'product': 'Produit',
        'service': 'Service',
        'customer': 'Client',
        'customerPhone': 'Téléphone client',
        'yourBusinessName': 'Nom de votre entreprise',
        'theCashier': 'Caissier',
        'tel': 'Tél',
        'tel2': 'Tél 2',
        'defaultGuaranteeText': 'Ce produit est garanti pendant ${warrantyPeriod}',
        'receiptNotFound': 'Reçu non trouvé',
        'receiptNotFoundDesc': "Le reçu que vous recherchez n'existe pas ou a été supprimé.",
        'enterReceiptId': "Entrez l'ID du reçu (ex: CR-283059)",
        'searchReceipt': 'Rechercher le reçu',
        'createShopNow': 'Créez votre boutique maintenant',
        'loadingReceipt': 'Chargement du reçu...',
        'subtotal': 'Sous-total',
        'total': 'Total',
        'tax': 'Taxe',
        'tableItem': 'Article',
        'tableType': 'Type',
        'tableQty': 'Qté',
        'tableUnitPrice': 'Prix unitaire',
        'tableSubtotal': 'Sous-total',
        'toBePaidOn': 'à payer le',
        'noRefundAfterPayment': 'aucun remboursement après paiement et test',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 Joyeuses fêtes !',
        'happyNewYear': '🎉 Bonne année !',
        'merryChristmas': '🎄 Joyeux Noël !',
        'eidMubarak': '🌙 Aïd Moubarak !',
        'happyDiwali': '🪔 Joyeux Diwali !',
        'itemsSingular': 'article',
        'itemsPlural': 'articles',
        'andMore': 'et {count} de plus',
        'forCustomer': 'Pour : {name}',
        
        // Badges
        'off': 'Désactivé',
        'independenceDay': "Jour de l'Indépendance",
        'laborDay': 'Fête du Travail',
        'veteransDay': 'Jour des Anciens Combattants',
        'remembranceDay': 'Jour du Souvenir',
        'republicDay': 'Fête de la République',
        'constitutionDay': 'Fête de la Constitution',
        'victoryDay': 'Jour de la Victoire',
        'unityDay': 'Jour de l\'Unité',
        'bankHoliday': 'Jour férié',
        'newYearsDay': 'Jour de l\'An',
        'lunarNewYear': 'Nouvel An Lunaire',
        'springFestival': 'Fête du Printemps',
        'christmasDay': 'Noël',
        'eidAlFitr': 'Aïd al-Fitr',
        'eidAlAdha': 'Aïd al-Adha',
        'diwali': 'Diwali',
        'easterSunday': 'Pâques',
        'hanukkah': 'Hanoukka',
        'vesakDay': 'Vesak',
        'epiphany': 'Épiphanie',
        'thanksgiving': 'Action de Grâce',
        'halloween': 'Halloween',
        'carnival': 'Carnaval',
        'midsummer': 'Solstice d\'été',
        'stPatricksDay': 'Saint-Patrick',
        'womensDay': 'Journée des Femmes',
        'childrensDay': 'Journée des Enfants',
        'earthDay': 'Journée de la Terre',
        'peaceDay': 'Journée de la Paix',
        'prideMonth': 'Mois des Fiertés',
        'boxingDay': 'Lendemain de Noël',
        'bastilleDay': 'Fête Nationale',
        'canadaDay': 'Fête du Canada',
        'anzacDay': 'Journée ANZAC',
        'kingsDay': 'Fête du Roi',
        'mayDay': 'Fête du Travail',
        'allSaintsDay': 'Toussaint',
        'nationalDay': 'Fête Nationale',
        'familyDay': 'Fête de la Famille',
        'youthDay': 'Journée de la Jeunesse',
        'none': 'Aucun'
    },

    sw: {
        // Receipt specific - Kiswahili
        'receiptInvoice': 'RISITI • INVOIS',
        'scanToVerify': 'Skani ili kuthibitisha',
        'advancePayment': 'Malipo ya Mbele',
        'amountPaid': 'Kiasi Kilicholipwa',
        'balanceDue': 'Salio Linalodaiwa',
        'thankYou': 'Asante kwa biashara yako!',
        'pleaseComeAgain': 'Tafadhali Rudi Tena',
        'computerGenerated': 'Hii ni hati iliyotengenezwa na kompyuta.',
        'printReceipt': 'Chapisha Risiti',
        'downloadPdf': 'Pakua PDF',
        'pdfPreparing': 'PDF inaandaliwa...',
        'pdfDownloadSuccess': 'PDF ya risiti imepakuliwa.',
        'pdfDownloadFailed': 'Imeshindwa kuunda PDF ya risiti. Tafadhali jaribu tena.',
        'receiptInstallTitle': 'Sakinisha StocksalesApp',
        'receiptInstallMessage': 'Sakinisha programu ili ufikie zana za duka lako haraka.',
        'installApp': 'Sakinisha programu',
        'openMicrosoftStore': 'Ipate kwenye Microsoft Store',
        'mobileInstallInstructionsIOS': 'Gusa Share, kisha uchague Add to Home Screen ili kusakinisha.',
        'mobileInstallInstructions': 'Fungua menyu ya kivinjari na uchague Install app au Add to Home Screen.',
        'installPromptFailed': 'Imeshindwa kufungua usakinishaji. Tumia menyu ya kivinjari.',
        'close': 'Funga',
        'receiptLinkCopied': 'Kiungo cha risiti kimenakiliwa!',
        'receiptLinkShared': 'Kiungo cha risiti kimenakiliwa! Kishiriki ili kuona risiti hii.',
        'receiptLinkCopyFailed': 'Imeshindwa kunakili kiungo. Tafadhali kinakili wewe mwenyewe.',
        'receiptModalUnavailable': 'Maelezo ya risiti hayapatikani.',
        'receiptLoadError': 'Imeshindwa kuonyesha risiti. Tafadhali jaribu tena.',
        'shareReceipt': 'Shiriki Risiti',
        'guarantee': 'Dhamana',
        'validUntil': 'Inatumika mpaka',
        'product': 'Bidhaa',
        'service': 'Huduma',
        'customer': 'Mteja',
        'customerPhone': 'Simu ya Mteja',
        'yourBusinessName': 'Jina la Biashara Yako',
        'theCashier': 'Keshia',
        'tel': 'Simu',
        'tel2': 'Simu 2',
        'defaultGuaranteeText': 'Bidhaa hii ina dhamana ya ${warrantyPeriod}',
        'receiptNotFound': 'Risiti Haipatikani',
        'receiptNotFoundDesc': 'Risiti unayotafuta haipo au imefutwa.',
        'enterReceiptId': 'Ingiza Kitambulisho cha Risiti (mfano: CR-283059)',
        'searchReceipt': 'Tafuta Risiti',
        'createShopNow': 'Anzisha duka lako sasa',
        'loadingReceipt': 'Inapakia risiti...',
        'subtotal': 'Jumla Ndogo',
        'total': 'Jumla',
        'tax': 'Kodi',
        'tableItem': 'Bidhaa',
        'tableType': 'Aina',
        'tableQty': 'Idadi',
        'tableUnitPrice': 'Bei ya Kizio',
        'tableSubtotal': 'Jumla Ndogo',
        'toBePaidOn': 'italipwa tarehe',
        'noRefundAfterPayment': 'hakuna marejesho baada ya malipo na upimaji',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 Sikukuu Njema!',
        'happyNewYear': '🎉 Mwaka Mpya Njema!',
        'merryChristmas': '🎄 Krismasi Njema!',
        'eidMubarak': '🌙 Eid Mubarak!',
        'happyDiwali': '🪔 Diwali Njema!',
        'itemsSingular': 'bidhaa',
        'itemsPlural': 'bidhaa',
        'andMore': 'na {count} zaidi',
        'forCustomer': 'Kwa: {name}',
        
        // Badges
        'off': 'Zima',
        'independenceDay': 'Siku ya Uhuru',
        'laborDay': 'Siku ya Wafanyakazi',
        'veteransDay': 'Siku ya Mashujaa',
        'remembranceDay': 'Siku ya Kumbukumbu',
        'republicDay': 'Siku ya Jamhuri',
        'constitutionDay': 'Siku ya Katiba',
        'victoryDay': 'Siku ya Ushindi',
        'unityDay': 'Siku ya Umoja',
        'bankHoliday': 'Siku ya Mapumziko',
        'newYearsDay': 'Siku ya Mwaka Mpya',
        'lunarNewYear': 'Mwaka Mpya wa Mwezi',
        'springFestival': 'Sherehe ya Spring',
        'christmasDay': 'Siku ya Krismasi',
        'eidAlFitr': 'Eid al-Fitr',
        'eidAlAdha': 'Eid al-Adha',
        'diwali': 'Diwali',
        'easterSunday': 'Jumapili ya Pasaka',
        'hanukkah': 'Hanukkah',
        'vesakDay': 'Siku ya Vesak',
        'epiphany': 'Epifania',
        'thanksgiving': 'Siku ya Kushukuru',
        'halloween': 'Halloween',
        'carnival': 'Karnivali',
        'midsummer': 'Msimu wa Kiangazi',
        'stPatricksDay': 'Siku ya St. Patrick',
        'womensDay': 'Siku ya Wanawake',
        'childrensDay': 'Siku ya Watoto',
        'earthDay': 'Siku ya Dunia',
        'peaceDay': 'Siku ya Amani',
        'prideMonth': 'Mwezi wa Fahari',
        'boxingDay': 'Siku ya Sanduku',
        'bastilleDay': 'Siku ya Bastille',
        'canadaDay': 'Siku ya Kanada',
        'anzacDay': 'Siku ya ANZAC',
        'kingsDay': 'Siku ya Mfalme',
        'mayDay': 'Siku ya Mei',
        'allSaintsDay': 'Siku ya Watakatifu',
        'nationalDay': 'Siku ya Taifa',
        'familyDay': 'Siku ya Familia',
        'youthDay': 'Siku ya Vijana',
        'none': 'Hakuna'
    },

    hi: {
        // Receipt specific - Hindi
        'receiptInvoice': 'रसीद • चालान',
        'scanToVerify': 'सत्यापित करने के लिए स्कैन करें',
        'advancePayment': 'अग्रिम भुगतान',
        'amountPaid': 'भुगतान की गई राशि',
        'balanceDue': 'बकाया राशि',
        'thankYou': 'आपके व्यवसाय के लिए धन्यवाद!',
        'pleaseComeAgain': 'कृपया फिर आएं',
        'computerGenerated': 'यह कंप्यूटर द्वारा उत्पन्न दस्तावेज़ है।',
        'printReceipt': 'रसीद प्रिंट करें',
        'downloadPdf': 'पीडीएफ डाउनलोड करें',
        'pdfPreparing': 'पीडीएफ तैयार हो रही है...',
        'pdfDownloadSuccess': 'रसीद की पीडीएफ डाउनलोड हो गई।',
        'pdfDownloadFailed': 'रसीद की पीडीएफ नहीं बन सकी। कृपया फिर से प्रयास करें।',
        'receiptInstallTitle': 'StocksalesApp इंस्टॉल करें',
        'receiptInstallMessage': 'दुकान के टूल जल्दी खोलने के लिए ऐप इंस्टॉल करें।',
        'installApp': 'ऐप इंस्टॉल करें',
        'openMicrosoftStore': 'Microsoft Store से प्राप्त करें',
        'mobileInstallInstructionsIOS': 'इंस्टॉल करने के लिए Share पर टैप करें, फिर Add to Home Screen चुनें।',
        'mobileInstallInstructions': 'ब्राउज़र मेनू खोलें और Install app या Add to Home Screen चुनें।',
        'installPromptFailed': 'इंस्टॉल विकल्प नहीं खुला। कृपया ब्राउज़र मेनू का उपयोग करें।',
        'close': 'बंद करें',
        'receiptLinkCopied': 'रसीद लिंक कॉपी हो गया!',
        'receiptLinkShared': 'रसीद लिंक कॉपी हो गया! रसीद देखने के लिए इसे साझा करें।',
        'receiptLinkCopyFailed': 'लिंक कॉपी नहीं हुआ। कृपया इसे मैन्युअल रूप से कॉपी करें।',
        'receiptModalUnavailable': 'रसीद का विवरण उपलब्ध नहीं है।',
        'receiptLoadError': 'रसीद नहीं दिखाई जा सकी। कृपया फिर से प्रयास करें।',
        'shareReceipt': 'रसीद साझा करें',
        'guarantee': 'गारंटी',
        'validUntil': 'मान्य है तक',
        'product': 'उत्पाद',
        'service': 'सेवा',
        'customer': 'ग्राहक',
        'customerPhone': 'ग्राहक का फोन',
        'yourBusinessName': 'आपका व्यवसाय नाम',
        'theCashier': 'कैशियर',
        'tel': 'टेल',
        'tel2': 'टेल 2',
        'defaultGuaranteeText': 'यह उत्पाद ${warrantyPeriod} के लिए गारंटीकृत है',
        'receiptNotFound': 'रसीद नहीं मिली',
        'receiptNotFoundDesc': 'आप जिस रसीद की तलाश कर रहे हैं वह मौजूद नहीं है या हटा दी गई है।',
        'enterReceiptId': 'रसीद आईडी दर्ज करें (जैसे: CR-283059)',
        'searchReceipt': 'रसीद खोजें',
        'createShopNow': 'अभी अपनी दुकान बनाएं',
        'loadingReceipt': 'रसीद लोड हो रही है...',
        'subtotal': 'उप-योग',
        'total': 'कुल',
        'tax': 'कर',
        'tableItem': 'वस्तु',
        'tableType': 'प्रकार',
        'tableQty': 'मात्रा',
        'tableUnitPrice': 'इकाई मूल्य',
        'tableSubtotal': 'उप-योग',
        'toBePaidOn': 'भुगतान करने की तिथि',
        'noRefundAfterPayment': 'भुगतान और परीक्षण के बाद कोई वापसी नहीं',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 शुभ छुट्टियां!',
        'happyNewYear': '🎉 नववर्ष की शुभकामनाएं!',
        'merryChristmas': '🎄 क्रिसमस की शुभकामनाएं!',
        'eidMubarak': '🌙 ईद मुबारक!',
        'happyDiwali': '🪔 दीपावली की शुभकामनाएं!',
        'itemsSingular': 'वस्तु',
        'itemsPlural': 'वस्तुएं',
        'andMore': 'और {count} अधिक',
        'forCustomer': 'के लिए: {name}',
        
        // Badges
        'off': 'बंद',
        'independenceDay': 'स्वतंत्रता दिवस',
        'laborDay': 'श्रम दिवस',
        'veteransDay': 'वयोवृद्ध दिवस',
        'remembranceDay': 'स्मरण दिवस',
        'republicDay': 'गणतंत्र दिवस',
        'constitutionDay': 'संविधान दिवस',
        'victoryDay': 'विजय दिवस',
        'unityDay': 'एकता दिवस',
        'bankHoliday': 'बैंक अवकाश',
        'newYearsDay': 'नव वर्ष दिवस',
        'lunarNewYear': 'चंद्र नव वर्ष',
        'springFestival': 'वसंत महोत्सव',
        'christmasDay': 'क्रिसमस दिवस',
        'eidAlFitr': 'ईद अल-फितर',
        'eidAlAdha': 'ईद अल-अधा',
        'diwali': 'दिवाली',
        'easterSunday': 'ईस्टर रविवार',
        'hanukkah': 'हनुक्का',
        'vesakDay': 'वेसाक दिवस',
        'epiphany': 'एपिफनी',
        'thanksgiving': 'थैंक्सगिविंग',
        'halloween': 'हैलोवीन',
        'carnival': 'कार्निवल',
        'midsummer': 'मिडसमर',
        'stPatricksDay': 'सेंट पैट्रिक दिवस',
        'womensDay': 'अंतर्राष्ट्रीय महिला दिवस',
        'childrensDay': 'बाल दिवस',
        'earthDay': 'पृथ्वी दिवस',
        'peaceDay': 'शांति दिवस',
        'prideMonth': 'प्राइड माह',
        'boxingDay': 'बॉक्सिंग दिवस',
        'bastilleDay': 'बैस्टिल दिवस',
        'canadaDay': 'कनाडा दिवस',
        'anzacDay': 'एंज़ैक दिवस',
        'kingsDay': 'राजा दिवस',
        'mayDay': 'मई दिवस',
        'allSaintsDay': 'ऑल सेंट्स दिवस',
        'nationalDay': 'राष्ट्रीय दिवस',
        'familyDay': 'परिवार दिवस',
        'youthDay': 'युवा दिवस',
        'none': 'कोई नहीं'
    },

    ms: {
        // Receipt specific - Bahasa Melayu
        'receiptInvoice': 'RESIT • INVOIS',
        'scanToVerify': 'Imbas untuk mengesahkan',
        'advancePayment': 'Bayaran Pendahuluan',
        'amountPaid': 'Jumlah Dibayar',
        'balanceDue': 'Baki Tertunggak',
        'thankYou': 'Terima kasih atas perniagaan anda!',
        'pleaseComeAgain': 'Sila Datang Lagi',
        'computerGenerated': 'Ini adalah dokumen yang dihasilkan oleh komputer.',
        'printReceipt': 'Cetak Resit',
        'downloadPdf': 'Muat Turun PDF',
        'pdfPreparing': 'Menyediakan PDF...',
        'pdfDownloadSuccess': 'PDF resit telah dimuat turun.',
        'pdfDownloadFailed': 'PDF resit tidak dapat dibuat. Sila cuba lagi.',
        'receiptInstallTitle': 'Pasang StocksalesApp',
        'receiptInstallMessage': 'Pasang aplikasi untuk akses lebih pantas kepada alat kedai anda.',
        'installApp': 'Pasang aplikasi',
        'openMicrosoftStore': 'Dapatkan daripada Microsoft Store',
        'mobileInstallInstructionsIOS': 'Ketik Share, kemudian pilih Add to Home Screen untuk memasang.',
        'mobileInstallInstructions': 'Buka menu pelayar dan pilih Install app atau Add to Home Screen.',
        'installPromptFailed': 'Tidak dapat membuka pemasangan. Sila gunakan menu pelayar.',
        'close': 'Tutup',
        'receiptLinkCopied': 'Pautan resit disalin!',
        'receiptLinkShared': 'Pautan resit disalin! Kongsikannya untuk melihat resit ini.',
        'receiptLinkCopyFailed': 'Pautan tidak dapat disalin. Sila salin secara manual.',
        'receiptModalUnavailable': 'Butiran resit tidak tersedia.',
        'receiptLoadError': 'Resit tidak dapat dipaparkan. Sila cuba lagi.',
        'shareReceipt': 'Kongsi Resit',
        'guarantee': 'Waranti',
        'validUntil': 'Sah sehingga',
        'product': 'Produk',
        'service': 'Perkhidmatan',
        'customer': 'Pelanggan',
        'customerPhone': 'Telefon Pelanggan',
        'yourBusinessName': 'Nama Perniagaan Anda',
        'theCashier': 'Juruwang',
        'tel': 'Tel',
        'tel2': 'Tel 2',
        'defaultGuaranteeText': 'Produk ini diwarantikan selama ${warrantyPeriod}',
        'receiptNotFound': 'Resit Tidak Dijumpai',
        'receiptNotFoundDesc': 'Resit yang anda cari tidak wujud atau telah dibuang.',
        'enterReceiptId': 'Masukkan ID Resit (contoh: CR-283059)',
        'searchReceipt': 'Cari Resit',
        'createShopNow': 'Buka kedai anda sekarang',
        'loadingReceipt': 'Memuatkan resit...',
        'subtotal': 'Jumlah Kecil',
        'total': 'Jumlah',
        'tax': 'Cukai',
        'tableItem': 'Barang',
        'tableType': 'Jenis',
        'tableQty': 'Kuantiti',
        'tableUnitPrice': 'Harga Seunit',
        'tableSubtotal': 'Jumlah Kecil',
        'toBePaidOn': 'akan dibayar pada',
        'noRefundAfterPayment': 'tiada bayaran balik selepas pembayaran dan ujian',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 Selamat Bercuti!',
        'happyNewYear': '🎉 Selamat Tahun Baru!',
        'merryChristmas': '🎄 Selamat Hari Krismas!',
        'eidMubarak': '🌙 Selamat Hari Raya!',
        'happyDiwali': '🪔 Selamat Hari Deepavali!',
        'itemsSingular': 'barang',
        'itemsPlural': 'barang',
        'andMore': 'dan {count} lagi',
        'forCustomer': 'Untuk: {name}',
        
        // Badges
        'off': 'Tutup',
        'independenceDay': 'Hari Kemerdekaan',
        'laborDay': 'Hari Buruh',
        'veteransDay': 'Hari Veteran',
        'remembranceDay': 'Hari Peringatan',
        'republicDay': 'Hari Republik',
        'constitutionDay': 'Hari Perlembagaan',
        'victoryDay': 'Hari Kemenangan',
        'unityDay': 'Hari Perpaduan',
        'bankHoliday': 'Cuti Bank',
        'newYearsDay': 'Hari Tahun Baru',
        'lunarNewYear': 'Tahun Baru Cina',
        'springFestival': 'Pesta Musim Bunga',
        'christmasDay': 'Hari Krismas',
        'eidAlFitr': 'Eid al-Fitr',
        'eidAlAdha': 'Eid al-Adha',
        'diwali': 'Diwali',
        'easterSunday': 'Ahad Paskah',
        'hanukkah': 'Hanukkah',
        'vesakDay': 'Hari Vesak',
        'epiphany': 'Epifani',
        'thanksgiving': 'Hari Kesyukuran',
        'halloween': 'Halloween',
        'carnival': 'Karnival',
        'midsummer': 'Pertengahan Musim Panas',
        'stPatricksDay': 'Hari St. Patrick',
        'womensDay': 'Hari Wanita Sedunia',
        'childrensDay': 'Hari Kanak-kanak',
        'earthDay': 'Hari Bumi',
        'peaceDay': 'Hari Keamanan',
        'prideMonth': 'Bulan Kebanggaan',
        'boxingDay': 'Hari Boxing',
        'bastilleDay': 'Hari Bastille',
        'canadaDay': 'Hari Kanada',
        'anzacDay': 'Hari ANZAC',
        'kingsDay': 'Hari Raja',
        'mayDay': 'Hari Mei',
        'allSaintsDay': 'Hari Semua Santo',
        'nationalDay': 'Hari Kebangsaan',
        'familyDay': 'Hari Keluarga',
        'youthDay': 'Hari Belia',
        'none': 'Tiada'
    },

    ar: {
        // Receipt specific - Arabic
        'receiptInvoice': 'إيصال • فاتورة',
        'scanToVerify': 'امسح للتحقق',
        'advancePayment': 'دفعة مقدمة',
        'amountPaid': 'المبلغ المدفوع',
        'balanceDue': 'الرصيد المستحق',
        'thankYou': 'شكراً لأعمالك!',
        'pleaseComeAgain': 'يرجى الزيارة مرة أخرى',
        'computerGenerated': 'هذا مستند تم إنشاؤه بواسطة الكمبيوتر.',
        'printReceipt': 'طباعة الإيصال',
        'downloadPdf': 'تحميل PDF',
        'pdfPreparing': 'جارٍ إعداد PDF...',
        'pdfDownloadSuccess': 'تم تنزيل PDF الإيصال.',
        'pdfDownloadFailed': 'تعذر إنشاء PDF للإيصال. يرجى المحاولة مرة أخرى.',
        'receiptInstallTitle': 'تثبيت StocksalesApp',
        'receiptInstallMessage': 'ثبّت التطبيق للوصول بسرعة إلى أدوات متجرك.',
        'installApp': 'تثبيت التطبيق',
        'openMicrosoftStore': 'احصل عليه من Microsoft Store',
        'mobileInstallInstructionsIOS': 'اضغط على مشاركة، ثم اختر إضافة إلى الشاشة الرئيسية للتثبيت.',
        'mobileInstallInstructions': 'افتح قائمة المتصفح واختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية.',
        'installPromptFailed': 'تعذر فتح التثبيت. يرجى استخدام قائمة المتصفح.',
        'close': 'إغلاق',
        'receiptLinkCopied': 'تم نسخ رابط الإيصال!',
        'receiptLinkShared': 'تم نسخ رابط الإيصال! شاركه لعرض هذا الإيصال.',
        'receiptLinkCopyFailed': 'تعذر نسخ الرابط. يرجى نسخه يدويًا.',
        'receiptModalUnavailable': 'تفاصيل الإيصال غير متاحة.',
        'receiptLoadError': 'تعذر عرض الإيصال. يرجى المحاولة مرة أخرى.',
        'shareReceipt': 'مشاركة الإيصال',
        'guarantee': 'ضمان',
        'validUntil': 'صالح حتى',
        'product': 'منتج',
        'service': 'خدمة',
        'customer': 'عميل',
        'customerPhone': 'هاتف العميل',
        'yourBusinessName': 'اسم عملك',
        'theCashier': 'أمين الصندوق',
        'tel': 'هاتف',
        'tel2': 'هاتف 2',
        'defaultGuaranteeText': 'هذا المنتج مضمون لمدة ${warrantyPeriod}',
        'receiptNotFound': 'الإيصال غير موجود',
        'receiptNotFoundDesc': 'الإيصال الذي تبحث عنه غير موجود أو تم حذفه.',
        'enterReceiptId': 'أدخل معرف الإيصال (مثال: CR-283059)',
        'searchReceipt': 'البحث عن الإيصال',
        'createShopNow': 'أنشئ متجرك الآن',
        'loadingReceipt': 'جاري تحميل الإيصال...',
        'subtotal': 'المجموع الفرعي',
        'total': 'المجموع الكلي',
        'tax': 'الضريبة',
        'tableItem': 'العنصر',
        'tableType': 'النوع',
        'tableQty': 'الكمية',
        'tableUnitPrice': 'سعر الوحدة',
        'tableSubtotal': 'المجموع الفرعي',
        'toBePaidOn': 'سيتم الدفع في',
        'noRefundAfterPayment': 'لا استرداد بعد الدفع والاختبار',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 عطلات سعيدة!',
        'happyNewYear': '🎉 سنة جديدة سعيدة!',
        'merryChristmas': '🎄 عيد ميلاد مجيد!',
        'eidMubarak': '🌙 عيد مبارك!',
        'happyDiwali': '🪔 ديوالي سعيد!',
        'itemsSingular': 'عنصر',
        'itemsPlural': 'عناصر',
        'andMore': 'و {count} المزيد',
        'forCustomer': 'لـ: {name}',
        
        // Badges
        'off': 'إيقاف',
        'independenceDay': 'يوم الاستقلال',
        'laborDay': 'يوم العمال',
        'veteransDay': 'يوم المحاربين القدامى',
        'remembranceDay': 'يوم الذكرى',
        'republicDay': 'يوم الجمهورية',
        'constitutionDay': 'يوم الدستور',
        'victoryDay': 'يوم النصر',
        'unityDay': 'يوم الوحدة',
        'bankHoliday': 'عطلة بنكية',
        'newYearsDay': 'رأس السنة الميلادية',
        'lunarNewYear': 'رأس السنة القمرية',
        'springFestival': 'مهرجان الربيع',
        'christmasDay': 'عيد الميلاد',
        'eidAlFitr': 'عيد الفطر',
        'eidAlAdha': 'عيد الأضحى',
        'diwali': 'ديوالي',
        'easterSunday': 'أحد الفصح',
        'hanukkah': 'حانوكا',
        'vesakDay': 'يوم فيساك',
        'epiphany': 'عيد الغطاس',
        'thanksgiving': 'عيد الشكر',
        'halloween': 'الهالوين',
        'carnival': 'الكرنفال',
        'midsummer': 'منتصف الصيف',
        'stPatricksDay': 'عيد القديس باتريك',
        'womensDay': 'اليوم العالمي للمرأة',
        'childrensDay': 'يوم الطفل',
        'earthDay': 'يوم الأرض',
        'peaceDay': 'يوم السلام',
        'prideMonth': 'شهر الفخر',
        'boxingDay': 'يوم الملاكمة',
        'bastilleDay': 'عيد الباستيل',
        'canadaDay': 'يوم كندا',
        'anzacDay': 'يوم أنزاك',
        'kingsDay': 'يوم الملك',
        'mayDay': 'يوم مايو',
        'allSaintsDay': 'عيد جميع القديسين',
        'nationalDay': 'اليوم الوطني',
        'familyDay': 'يوم الأسرة',
        'youthDay': 'يوم الشباب',
        'none': 'لا شيء'
    },

    es: {
        // Receipt specific - Spanish
        'receiptInvoice': 'RECIBO • FACTURA',
        'scanToVerify': 'Escanear para verificar',
        'advancePayment': 'Pago Anticipado',
        'amountPaid': 'Monto Pagado',
        'balanceDue': 'Saldo Pendiente',
        'thankYou': '¡Gracias por su negocio!',
        'pleaseComeAgain': 'Por favor, vuelva pronto',
        'computerGenerated': 'Este es un documento generado por computadora.',
        'printReceipt': 'Imprimir Recibo',
        'downloadPdf': 'Descargar PDF',
        'pdfPreparing': 'Preparando PDF...',
        'pdfDownloadSuccess': 'Se descargó el PDF del recibo.',
        'pdfDownloadFailed': 'No se pudo crear el PDF del recibo. Inténtalo de nuevo.',
        'receiptInstallTitle': 'Instalar StocksalesApp',
        'receiptInstallMessage': 'Instala la aplicación para acceder más rápido a las herramientas de tu tienda.',
        'installApp': 'Instalar aplicación',
        'openMicrosoftStore': 'Obtener en Microsoft Store',
        'mobileInstallInstructionsIOS': 'Toca Compartir y luego Añadir a pantalla de inicio para instalar.',
        'mobileInstallInstructions': 'Abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio.',
        'installPromptFailed': 'No se pudo abrir la instalación. Usa el menú del navegador.',
        'close': 'Cerrar',
        'receiptLinkCopied': '¡Enlace del recibo copiado!',
        'receiptLinkShared': '¡Enlace del recibo copiado! Compártelo para ver este recibo.',
        'receiptLinkCopyFailed': 'No se pudo copiar el enlace. Cópialo manualmente.',
        'receiptModalUnavailable': 'Los detalles del recibo no están disponibles.',
        'receiptLoadError': 'No se pudo mostrar el recibo. Inténtalo de nuevo.',
        'shareReceipt': 'Compartir Recibo',
        'guarantee': 'Garantía',
        'validUntil': 'Válido hasta',
        'product': 'Producto',
        'service': 'Servicio',
        'customer': 'Cliente',
        'customerPhone': 'Teléfono del Cliente',
        'yourBusinessName': 'Nombre de su Negocio',
        'theCashier': 'Cajero',
        'tel': 'Tel',
        'tel2': 'Tel 2',
        'defaultGuaranteeText': 'Este producto está garantizado por ${warrantyPeriod}',
        'receiptNotFound': 'Recibo No Encontrado',
        'receiptNotFoundDesc': 'El recibo que busca no existe o ha sido eliminado.',
        'enterReceiptId': 'Ingrese ID del Recibo (ej: CR-283059)',
        'searchReceipt': 'Buscar Recibo',
        'createShopNow': 'Cree su tienda ahora',
        'loadingReceipt': 'Cargando recibo...',
        'subtotal': 'Subtotal',
        'total': 'Total',
        'tax': 'Impuesto',
        'tableItem': 'Artículo',
        'tableType': 'Tipo',
        'tableQty': 'Cant',
        'tableUnitPrice': 'Precio Unitario',
        'tableSubtotal': 'Subtotal',
        'toBePaidOn': 'a pagar el',
        'noRefundAfterPayment': 'sin reembolso después del pago y prueba',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 ¡Felices Fiestas!',
        'happyNewYear': '🎉 ¡Feliz Año Nuevo!',
        'merryChristmas': '🎄 ¡Feliz Navidad!',
        'eidMubarak': '🌙 ¡Feliz Eid!',
        'happyDiwali': '🪔 ¡Feliz Diwali!',
        'itemsSingular': 'artículo',
        'itemsPlural': 'artículos',
        'andMore': 'y {count} más',
        'forCustomer': 'Para: {name}',
        
        // Badges
        'off': 'Apagado',
        'independenceDay': 'Día de la Independencia',
        'laborDay': 'Día del Trabajo',
        'veteransDay': 'Día de los Veteranos',
        'remembranceDay': 'Día del Recuerdo',
        'republicDay': 'Día de la República',
        'constitutionDay': 'Día de la Constitución',
        'victoryDay': 'Día de la Victoria',
        'unityDay': 'Día de la Unidad',
        'bankHoliday': 'Día Festivo',
        'newYearsDay': 'Año Nuevo',
        'lunarNewYear': 'Año Nuevo Lunar',
        'springFestival': 'Festival de Primavera',
        'christmasDay': 'Navidad',
        'eidAlFitr': 'Eid al-Fitr',
        'eidAlAdha': 'Eid al-Adha',
        'diwali': 'Diwali',
        'easterSunday': 'Domingo de Pascua',
        'hanukkah': 'Janucá',
        'vesakDay': 'Día de Vesak',
        'epiphany': 'Epifanía',
        'thanksgiving': 'Día de Acción de Gracias',
        'halloween': 'Halloween',
        'carnival': 'Carnaval',
        'midsummer': 'Solsticio de Verano',
        'stPatricksDay': 'Día de San Patricio',
        'womensDay': 'Día de la Mujer',
        'childrensDay': 'Día del Niño',
        'earthDay': 'Día de la Tierra',
        'peaceDay': 'Día de la Paz',
        'prideMonth': 'Mes del Orgullo',
        'boxingDay': 'Día de San Esteban',
        'bastilleDay': 'Día de la Bastilla',
        'canadaDay': 'Día de Canadá',
        'anzacDay': 'Día de ANZAC',
        'kingsDay': 'Día del Rey',
        'mayDay': 'Primero de Mayo',
        'allSaintsDay': 'Día de Todos los Santos',
        'nationalDay': 'Día Nacional',
        'familyDay': 'Día de la Familia',
        'youthDay': 'Día de la Juventud',
        'none': 'Ninguno'
    },

    zh: {
        // Receipt specific - Chinese Simplified
        'receiptInvoice': '收据 • 发票',
        'scanToVerify': '扫描验证',
        'advancePayment': '预付款',
        'amountPaid': '已付金额',
        'balanceDue': '应付余额',
        'thankYou': '感谢您的惠顾！',
        'pleaseComeAgain': '欢迎再次光临',
        'computerGenerated': '这是一份电脑生成的文件。',
        'printReceipt': '打印收据',
        'downloadPdf': '下载PDF',
        'pdfPreparing': '正在准备 PDF...',
        'pdfDownloadSuccess': '收据 PDF 已下载。',
        'pdfDownloadFailed': '无法创建收据 PDF，请重试。',
        'receiptInstallTitle': '安装 StocksalesApp',
        'receiptInstallMessage': '安装应用以更快访问您的店铺工具。',
        'installApp': '安装应用',
        'openMicrosoftStore': '从 Microsoft Store 获取',
        'mobileInstallInstructionsIOS': '轻点“分享”，然后选择“添加到主屏幕”进行安装。',
        'mobileInstallInstructions': '打开浏览器菜单并选择“安装应用”或“添加到主屏幕”。',
        'installPromptFailed': '无法打开安装提示，请使用浏览器菜单。',
        'close': '关闭',
        'receiptLinkCopied': '收据链接已复制！',
        'receiptLinkShared': '收据链接已复制！分享链接即可查看此收据。',
        'receiptLinkCopyFailed': '无法复制链接，请手动复制。',
        'receiptModalUnavailable': '收据信息不可用。',
        'receiptLoadError': '无法显示收据，请重试。',
        'shareReceipt': '分享收据',
        'guarantee': '保修',
        'validUntil': '有效期至',
        'product': '产品',
        'service': '服务',
        'customer': '客户',
        'customerPhone': '客户电话',
        'yourBusinessName': '您的商户名称',
        'theCashier': '收银员',
        'tel': '电话',
        'tel2': '电话2',
        'defaultGuaranteeText': '本产品保修${warrantyPeriod}',
        'receiptNotFound': '未找到收据',
        'receiptNotFoundDesc': '您查找的收据不存在或已被删除。',
        'enterReceiptId': '输入收据ID（例如：CR-283059）',
        'searchReceipt': '搜索收据',
        'createShopNow': '立即创建您的店铺',
        'loadingReceipt': '正在加载收据...',
        'subtotal': '小计',
        'total': '总计',
        'tax': '税费',
        'tableItem': '项目',
        'tableType': '类型',
        'tableQty': '数量',
        'tableUnitPrice': '单价',
        'tableSubtotal': '小计',
        'toBePaidOn': '应付款日期',
        'noRefundAfterPayment': '付款和测试后不予退款',
        
        // NEW: Share preview strings
        'happyHolidays': '🎉 节日快乐！',
        'happyNewYear': '🎉 新年快乐！',
        'merryChristmas': '🎄 圣诞快乐！',
        'eidMubarak': '🌙 开斋节吉庆！',
        'happyDiwali': '🪔 排灯节快乐！',
        'itemsSingular': '件商品',
        'itemsPlural': '件商品',
        'andMore': '以及另外 {count} 件',
        'forCustomer': '致：{name}',
        
        // Badges
        'off': '关闭',
        'independenceDay': '独立日',
        'laborDay': '劳动节',
        'veteransDay': '退伍军人节',
        'remembranceDay': '阵亡将士纪念日',
        'republicDay': '共和国日',
        'constitutionDay': '宪法日',
        'victoryDay': '胜利日',
        'unityDay': '团结日',
        'bankHoliday': '银行假日',
        'newYearsDay': '元旦',
        'lunarNewYear': '农历新年',
        'springFestival': '春节',
        'christmasDay': '圣诞节',
        'eidAlFitr': '开斋节',
        'eidAlAdha': '宰牲节',
        'diwali': '排灯节',
        'easterSunday': '复活节',
        'hanukkah': '光明节',
        'vesakDay': '卫塞节',
        'epiphany': '主显节',
        'thanksgiving': '感恩节',
        'halloween': '万圣节',
        'carnival': '狂欢节',
        'midsummer': '仲夏节',
        'stPatricksDay': '圣帕特里克节',
        'womensDay': '国际妇女节',
        'childrensDay': '儿童节',
        'earthDay': '地球日',
        'peaceDay': '和平日',
        'prideMonth': '骄傲月',
        'boxingDay': '节礼日',
        'bastilleDay': '巴士底日',
        'canadaDay': '加拿大日',
        'anzacDay': '澳新军团日',
        'kingsDay': '国王节',
        'mayDay': '五一劳动节',
        'allSaintsDay': '万圣节',
        'nationalDay': '国庆日',
        'familyDay': '家庭日',
        'youthDay': '青年节',
        'none': '无'
    }
};


// Set default language
let currentLanguage = localStorage.getItem('language') || 'en';

function updateLanguageDirection(language) {
    const selectedLanguage = String(language || 'en').toLowerCase();
    const isArabic = selectedLanguage === 'ar';

    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';

    if (document.body) {
        document.body.dir = isArabic ? 'rtl' : 'ltr';
        document.body.classList.toggle('arabic-language', isArabic);
    }

    document.documentElement.classList.toggle('arabic-language', isArabic);
}

function translate(key) {
  
    if (!key) return '';


    const keys = String(key).split('.');
    let translationObj = translations[currentLanguage] || translations['en'] || translations;

    for (let i = 0; i < keys.length; i++) {
        if (translationObj && translationObj[keys[i]] !== undefined) {
            translationObj = translationObj[keys[i]];
        } else {
            console.warn(`Key "${key}" not found in translations`);
            return String(key);
        }
    }

    return translationObj;
}

updateLanguageDirection(currentLanguage);

// Make translations available globally
if (typeof window !== 'undefined') {
    window.translations = translations;
    window.currentLanguage = currentLanguage;
}
function applyTranslations() {
    console.log('🔄 Applying translations for language:', currentLanguage);
    
    // Get all elements with data-translate attribute
    const elements = document.querySelectorAll('[data-translate]');
    
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = translate(key);
        
        // Handle different element types
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.hasAttribute('placeholder')) {
                element.setAttribute('placeholder', translation);
            } else {
                element.value = translation;
            }
        } else if (element.tagName === 'IMG' && element.hasAttribute('alt')) {
            element.setAttribute('alt', translation);
        } else {
            element.textContent = translation;
        }
    });
    
    // Also translate title attributes
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        element.setAttribute('title', translate(key));
    });
    
    console.log('✅ Translations applied successfully');
}


// Badge definitions: each has an id, svg content, and translation key
const badgeOptions = [
    { id: 'off', svg: '', textKey: 'none', label: 'Off' },

    { 
        id: 'independence', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L14 9H21L16 14L18 21L12 17L6 21L8 14L3 9H10L12 2Z" fill="currentColor"/></svg>`, 
        textKey: 'independenceDay' 
    },
    { 
        id: 'labor', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-6.77 0z"/><path d="m11 10 2 2M15 14l2 2M2 22l5-5M11 13l-4.5 4.5M13 11l4.5-4.5"/></svg>`, 
        textKey: 'laborDay' 
    },
    { 
        id: 'veterans', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15 8H22L17 12L19 18L12 15L5 18L7 12L2 8H9L12 2Z" fill="currentColor"/></svg>`, 
        textKey: 'veteransDay' 
    },
    { 
        id: 'remembrance', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 6V12L16 14"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`, 
        textKey: 'remembranceDay' 
    },
    { 
        id: 'republic', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 21V10M19 21V10M9 21V10M15 21V10M12 2l7 8H5l7-8z"/></svg>`, 
        textKey: 'republicDay' 
    },
    { 
        id: 'constitution', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v15H6.5a1 1 0 0 0-1 1"/></svg>`, 
        textKey: 'constitutionDay' 
    },
    { 
        id: 'victory', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3L12 12L17 3M12 12V21"/></svg>`, 
        textKey: 'victoryDay' 
    },
    { 
        id: 'unity', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, 
        textKey: 'unityDay' 
    },
    { 
        id: 'bank_holiday', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h.01M11 15h.01"/></svg>`, 
        textKey: 'bankHoliday' 
    },

    // --- NEW YEAR & LUNAR ---
    { 
        id: 'newyear', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>`, 
        textKey: 'newYearsDay' 
    },
    { 
        id: 'lunar_ny', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 5H15L12 2ZM8 7V17C8 18.1 8.9 19 10 19H14C15.1 19 16 18.1 16 17V7H8Z"/></svg>`, 
        textKey: 'lunarNewYear' 
    },
    { 
        id: 'spring_fest', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M12 14v6M12 4v2M12 10l-2-2M12 10l2-2"/></svg>`, 
        textKey: 'springFestival' 
    },

    // --- RELIGIOUS ---
    { 
        id: 'christmas', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L5 19H19L12 3Z"/><path d="M12 19V22"/></svg>`, 
        textKey: 'christmasDay' 
    },
    { 
        id: 'eid_fitr', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c.44-.06.9-.1 1.36-.1A9 9 0 0 0 12 3Z"/></svg>`, 
        textKey: 'eidAlFitr' 
    },
    { 
        id: 'eid_adha', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 13V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M16 13h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4v-6Z"/></svg>`, 
        textKey: 'eidAlAdha' 
    },
    { 
        id: 'diwali', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s-3 4-3 6c0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-3-6-3-6z"/><path d="M5 16c0 3 3.5 5 7 5s7-2 7-5H5z"/></svg>`, 
        textKey: 'diwali' 
    },
    { 
        id: 'easter', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a8 10 0 1 0 0-20 8 10 0 0 0 0 20z"/></svg>`, 
        textKey: 'easterSunday' 
    },
    { 
        id: 'hanukkah', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7v14M9 8v13M15 8v13M6 10v11M18 10v11M3 12v9M21 12v9"/></svg>`, 
        textKey: 'hanukkah' 
    },
    { 
        id: 'vesak', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>`, 
        textKey: 'vesakDay' 
    },
    { 
        id: 'epiphany', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`, 
        textKey: 'epiphany' 
    },

    // --- SEASONAL & CULTURAL ---
    { 
        id: 'thanksgiving', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0-9 9v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1a9 9 0 0 0-9-9z"/><path d="M12 15v3"/></svg>`, 
        textKey: 'thanksgiving' 
    },
    { 
        id: 'halloween', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M8 10l1-1M16 10l-1-1M12 16h.01"/></svg>`, 
        textKey: 'halloween' 
    },
    { 
        id: 'carnival', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM6 7c1.1 0 2-.9 2-2S7.1 3 6 3 4 3.9 4 5s.9 2 2 2zM12 21c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8z"/></svg>`, 
        textKey: 'carnival' 
    },
    { 
        id: 'midsummer', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`, 
        textKey: 'midsummer' 
    },
    { 
        id: 'st_patricks', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-.5 4-4 4-4 7 0 2 2 3 4 1 2 2 4 1 4-1 0-3-3.5-3-4-7zm-1 10c-4 0-4 4-7 4-2 0-3-2-1-4-2-2-1-4 1-4 3 0 3 3.5 7 4zm2 0c4 0 4 4 7 4 2 0 3-2 1-4 2-2 1-4-1-4-3 0-3 3.5-7 4z"/></svg>`, 
        textKey: 'stPatricksDay' 
    },

    // --- INTERNATIONAL & SOCIAL ---
    { 
        id: 'womens_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M12 13v8M9 17h6"/></svg>`, 
        textKey: 'womensDay' 
    },
    { 
        id: 'childrens_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7c2.76 0 5-2.24 5-5M7 2c0 2.76 2.24 5 5 5m0 0v15M9 15l-4 4M15 15l4 4"/></svg>`, 
        textKey: 'childrensDay' 
    },
    { 
        id: 'earth_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>`, 
        textKey: 'earthDay' 
    },
    { 
        id: 'peace_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M12 2v10M12 12l4 4M12 12l-4 4"/></svg>`, 
        textKey: 'peaceDay' 
    },
    { 
        id: 'pride', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a8 8 0 0 1 16 0"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M8 16a4 4 0 0 1 8 0"/></svg>`, 
        textKey: 'prideMonth' 
    },

    // --- MISC / REGIONAL ---
    { 
        id: 'boxing_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V3M12 8l-4-4M12 8l4-4"/></svg>`, 
        textKey: 'boxingDay' 
    },
    { 
        id: 'bastille', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21h16M5 21V7l7-4 7 4v14M9 21V11h6v10"/></svg>`, 
        textKey: 'bastilleDay' 
    },
    { 
        id: 'canada_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z"/></svg>`, 
        textKey: 'canadaDay' 
    },
    { 
        id: 'anzac', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`, 
        textKey: 'anzacDay' 
    },
    { 
        id: 'kings_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l-2-7 5 2 4-7 4 7 5-2-2 7h-14z"/></svg>`, 
        textKey: 'kingsDay' 
    },
    { 
        id: 'may_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M5 5l14 14M19 5L5 19"/></svg>`, 
        textKey: 'mayDay' 
    },
    { 
        id: 'all_saints', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M7 21v-2a5 5 0 0 1 10 0v2"/></svg>`, 
        textKey: 'allSaintsDay' 
    },
    { 
        id: 'independence_secondary', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12zM4 22v-7"/></svg>`, 
        textKey: 'nationalDay' 
    },
    { 
        id: 'family_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="18" cy="11" r="3"/><path d="M15 21v-1.5a2.5 2.5 0 0 1 5 0V21"/></svg>`, 
        textKey: 'familyDay' 
    },
    { 
        id: 'youth_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M12 12v9m-4-4l4-4 4 4"/></svg>`, 
        textKey: 'youthDay' 
    }
];

let currentBadgeIndex = 0; // 0 = off

// Function to update badge based on index
function autoSetBadge() {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth is 0-indexed
    const day = today.getDate();

    // Map fixed-date holidays to their IDs
    const holidayMap = {
        '1-1': 'newyear',
        '1-6': 'epiphany',
        '1-26': 'republic',     // India Republic Day
        '3-8': 'womens_day',
        '3-17': 'st_patricks',
        '4-22': 'earth_day',
        '4-27': 'kings_day',    // Netherlands
        '5-1': 'may_day',       // Also laborDay in many countries
        '5-5': 'independence_secondary', // Cinco de Mayo
        '6-1': 'childrens_day',
        '6-21': 'midsummer',
        '7-1': 'canada_day',
        '7-4': 'independence',  // USA
        '7-14': 'bastille',
        '8-15': 'independence_secondary', // India/Korea
        '9-21': 'peace_day',
        '10-31': 'halloween',
        '11-1': 'all_saints',
        '11-11': 'remembrance', // Veterans Day / Remembrance Day
        '12-25': 'christmas',
        '12-26': 'boxing_day'
    };

    const key = `${month}-${day}`;
    const holidayId = holidayMap[key];

    if (holidayId) {
        setFestiveBadgeById(holidayId);
    } else {
        setFestiveBadgeById('off');
    }
}
function updateBadge(index) {
    const badge = document.getElementById('festiveBadge');
    const iconSpan = document.getElementById('badgeIcon');
    const textSpan = document.getElementById('badgeText');
    const badgeTextforsettingview = document.getElementById('badgeTextforsettingview');

    // ✅ NEW: Check if Custom Badge is enabled and has text
    if (window.businessInfo && businessInfo.festiveBadgeEnabled && businessInfo.useCustomBadge && businessInfo.customBadgeText) {
        if (iconSpan) {
            // Generic tag/offer icon for custom badges
            iconSpan.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
        }
        if (textSpan) {
            textSpan.textContent = businessInfo.customBadgeText;
            textSpan.removeAttribute('data-translate'); // Don't try to translate custom text
        }
        if (badgeTextforsettingview) {
            badgeTextforsettingview.textContent = businessInfo.customBadgeText + " (Custom)";
            badgeTextforsettingview.removeAttribute('data-translate');
        }
        if (badge) badge.classList.remove('hidden');
        currentBadgeIndex = index;
        return; // Exit early, custom badge takes precedence
    }

    // Standard holiday badge logic (unchanged)
    if (typeof badgeOptions === 'undefined' || !badgeOptions[index]) {
        if (badge) badge.classList.add('hidden');
        return;
    }

    const option = badgeOptions[index];

    if (index === 0) { // off
        if (badge) badge.classList.add('hidden');
        if (badgeTextforsettingview) {
            badgeTextforsettingview.setAttribute('data-translate', 'off');
            badgeTextforsettingview.textContent = (typeof translate === 'function' ? translate('off') : 'Off');
        }
    } else {
        if (iconSpan) iconSpan.innerHTML = option.svg || '';
        if (textSpan) {
            if (option.textKey && option.textKey.trim() !== '') {
                textSpan.setAttribute('data-translate', option.textKey);
                textSpan.textContent = (typeof translate === 'function' ? translate(option.textKey) : option.textKey.replace(/([A-Z])/g, ' $1').trim());
            } else {
                textSpan.textContent = 'Festive';
                textSpan.removeAttribute('data-translate');
            }
        }
        if (badgeTextforsettingview) {
            if (option.textKey && option.textKey.trim() !== '') {
                badgeTextforsettingview.setAttribute('data-translate', option.textKey);
                badgeTextforsettingview.textContent = (typeof translate === 'function' ? translate(option.textKey) : option.textKey.replace(/([A-Z])/g, ' $1').trim());
            } else {
                badgeTextforsettingview.textContent = 'Festive';
                badgeTextforsettingview.removeAttribute('data-translate');
            }
        }
        if (badge) badge.classList.remove('hidden');
    }

    currentBadgeIndex = index;
    if (window.businessInfo) {
        businessInfo.currentBadgeIndex = index;
        businessInfo.festiveBadgeEnabled = index !== 0;
        localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
    }
}

// Toggle function – cycles to next option
function toggleFestiveBadge() {
    const nextIndex = (currentBadgeIndex + 1) % badgeOptions.length;
    updateBadge(nextIndex);
}

function toggleFestiveBadgeoff() {
    console.log('toggleFestiveBadgeoff called');
    
    const toggleSwitch = document.getElementById('toggleBadgeswithc');
    const hidebtn = document.getElementById('toggleBadgeBtn');
    const badgeTextforsettingview = document.getElementById('badgeTextforsettingview');
    
    if (!toggleSwitch) {
        console.log('Toggle switch not found');
        return;
    }

    const enabled = toggleSwitch.checked;
    console.log('Toggle enabled:', enabled);

    if (!enabled) {
        console.log('Disabling badges via toggle');
        updateBadge(0);
        if (hidebtn) hidebtn.classList.add('hidden');
        
        // Update settings view text
        if (badgeTextforsettingview) {
            badgeTextforsettingview.setAttribute('data-translate', 'off');
            if (typeof translate === 'function') {
                badgeTextforsettingview.textContent = translate('off');
            } else {
                badgeTextforsettingview.textContent = 'Off';
            }
        }
        
        // Update businessInfo
        if (window.businessInfo) {
            businessInfo.festiveBadgeEnabled = false;
            businessInfo.currentBadgeIndex = 0;
            localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
        }
    } else {
        console.log('Enabling badges via toggle');
        
        // When enabling, use the saved index or default to 1
        const savedIndex = (window.businessInfo && businessInfo.currentBadgeIndex && businessInfo.currentBadgeIndex !== 0) 
            ? businessInfo.currentBadgeIndex 
            : 1;
            
        console.log('Using index:', savedIndex);
        
        updateBadge(savedIndex);
        if (hidebtn) hidebtn.classList.remove('hidden');
        
        // Update businessInfo
        if (window.businessInfo) {
            businessInfo.festiveBadgeEnabled = true;
            businessInfo.currentBadgeIndex = savedIndex;
            localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
        }
    }
}

// Optional: direct set by ID
function setFestiveBadgeById(id) {
    const index = badgeOptions.findIndex(opt => opt.id === id);
    if (index !== -1) updateBadge(index);
}

