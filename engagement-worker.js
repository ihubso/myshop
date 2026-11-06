
// ========================================
// ENGAGEMENT WORKER - ALL HEAVY LOGIC HERE
// ========================================


debugLog('📱 Engagement Worker loading...');

// ========================================
// INDEXEDDB HELPERS
// ========================================
function openEngagementDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EngagementDB', 2);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Engagement & Config
            if (!db.objectStoreNames.contains('engagements')) {
                db.createObjectStore('engagements', { keyPath: 'id' });
            }
            
            // Activity & Timestamps
            if (!db.objectStoreNames.contains('activity')) {
                db.createObjectStore('activity', { keyPath: 'id' });
            }
            
            // Stock Data (items with quantities)
            if (!db.objectStoreNames.contains('stock')) {
                db.createObjectStore('stock', { keyPath: 'id' });
            }
            
            // Sales Data (daily/historical sales records)
            if (!db.objectStoreNames.contains('sales')) {
                const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
                salesStore.createIndex('date', 'date', { unique: false });
            }
            
            // Credit/Loan Data (customer credits, personal loans, etc.)
            if (!db.objectStoreNames.contains('credits')) {
                const creditStore = db.createObjectStore('credits', { keyPath: 'id' });
                creditStore.createIndex('type', 'type', { unique: false });
            }
            
            // Reminders & Notifications
            if (!db.objectStoreNames.contains('reminders')) {
                const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
                reminderStore.createIndex('dueDate', 'dueDate', { unique: false });
            }
            
            // User Data (preferences, settings, language, etc.)
            if (!db.objectStoreNames.contains('userData')) {
                db.createObjectStore('userData', { keyPath: 'id' });
            }
            
            // Sync Queue (for queuing updates when offline)
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

async function getEngagementData() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['engagements'], 'readonly');
            const store = transaction.objectStore('engagements');
            const request = store.get('schedule');
            request.onsuccess = () => resolve(request.result?.data || {});
            request.onerror = () => resolve({});
        });
    } catch {
        return {};
    }
}

async function updateEngagementData(data) {
    try {
        const db = await openEngagementDB();
        const existing = await getEngagementData();
        const updated = { ...existing, ...data };
        
        return new Promise((resolve, reject) => { // 🔥 Changed to reject on error
            const transaction = db.transaction(['engagements'], 'readwrite');
            const store = transaction.objectStore('engagements');
            store.put({ id: 'schedule', data: updated });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = (e) => {
                console.error('❌ Failed to save engagement data:', e.target.error);
                reject(e.target.error); // 🔥 Let the caller know it failed
            };
        });
    } catch (error) {
        console.error('❌ updateEngagementData failed:', error);
        throw error; 
    }
}

async function getUserLanguage() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['engagements'], 'readonly');
            const store = transaction.objectStore('engagements');
            const request = store.get('userLanguage');
            request.onsuccess = () => resolve(request.result?.language || 'en');
            request.onerror = () => resolve('en');
        });
    } catch {
        return 'en';
    }
}

async function getLastActivityTime() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['activity'], 'readonly');
            const store = transaction.objectStore('activity');
            const request = store.get('lastActivity');
            request.onsuccess = () => {
                resolve(request.result?.timestamp || Date.now() - (7 * 24 * 60 * 60 * 1000));
            };
            request.onerror = () => resolve(Date.now() - (7 * 24 * 60 * 60 * 1000));
        });
    } catch {
        return Date.now() - (7 * 24 * 60 * 60 * 1000);
    }
}

async function getLocalStockData() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['stock'], 'readonly');
            const store = transaction.objectStore('stock');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

// ========================================
// SALES DATA HELPERS
// ========================================
async function saveSalesData(salesArray) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['sales'], 'readwrite');
            const store = transaction.objectStore('sales');
            store.clear();
            salesArray.forEach(sale => {
                store.put({ id: sale.id || `sale_${Date.now()}`, ...sale, date: sale.date || new Date().toISOString() });
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch (error) {
        debugWarn('Error saving sales data:', error);
        return false;
    }
}

async function getSalesData(dateFilter = null) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['sales'], 'readonly');
            const store = transaction.objectStore('sales');
            const request = store.getAll();
            request.onsuccess = () => {
                let data = request.result || [];
                if (dateFilter) {
                    data = data.filter(sale => sale.date && sale.date.startsWith(dateFilter));
                }
                resolve(data);
            };
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

// ========================================
// CREDIT/LOAN DATA HELPERS
// ========================================
async function saveCreditData(creditsArray) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['credits'], 'readwrite');
            const store = transaction.objectStore('credits');
            store.clear();
            creditsArray.forEach(credit => {
                store.put({ id: credit.id || `credit_${Date.now()}`, ...credit });
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch (error) {
        debugWarn('Error saving credit data:', error);
        return false;
    }
}

async function getCreditData(type = null) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['credits'], 'readonly');
            const store = transaction.objectStore('credits');
            let request;
            if (type) {
                const index = store.index('type');
                request = index.getAll(type);
            } else {
                request = store.getAll();
            }
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

// ========================================
// REMINDERS/NOTIFICATIONS HELPERS
// ========================================
async function saveReminderData(remindersArray) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['reminders'], 'readwrite');
            const store = transaction.objectStore('reminders');
            store.clear();
            remindersArray.forEach(reminder => {
                store.put({ id: reminder.id || `reminder_${Date.now()}`, ...reminder });
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch (error) {
        debugWarn('Error saving reminder data:', error);
        return false;
    }
}

async function getReminderData() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['reminders'], 'readonly');
            const store = transaction.objectStore('reminders');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    } catch {
        return [];
    }
}

// ========================================
// USER DATA HELPERS
// ========================================
async function saveUserData(userData) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['userData'], 'readwrite');
            const store = transaction.objectStore('userData');
            store.put({ id: 'userSettings', ...userData, timestamp: Date.now() });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch (error) {
        debugWarn('Error saving user data:', error);
        return false;
    }
}

async function getUserData() {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['userData'], 'readonly');
            const store = transaction.objectStore('userData');
            const request = store.get('userSettings');
            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => resolve({});
        });
    } catch {
        return {};
    }
}

// ========================================
// STOCK DATA HELPERS
// ========================================
async function saveStockData(stockArray) {
    try {
        const db = await openEngagementDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(['stock'], 'readwrite');
            const store = transaction.objectStore('stock');
            store.clear();
            stockArray.forEach(item => {
                store.put({ id: item.id || `stock_${Date.now()}`, ...item });
            });
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => resolve(false);
        });
    } catch (error) {
        debugWarn('Error saving stock data:', error);
        return false;
    }
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ========================================
// ENGAGEMENT MESSAGES (COMPLETE - ALL LANGUAGES)
// ========================================
function getEngagementMessages(type, language = 'en') {
    const messages = {
        en: {
            morning: [
                { title: '🌅 Good Morning!', body: 'Start your day by checking stock levels!' },
                { title: '☀️ Rise and Shine!', body: 'Your business awaits! Check inventory now.' },
                { title: '📈 Morning Update', body: 'Ready to manage your stock today?' }
            ],
            midday_reminder: [
                { title: '☀️ Afternoon Check', body: 'How are your sales going today?' },
                { title: '📊 Midday Update', body: 'Time to check your stock levels and sales!' },
                { title: '💼 Business Check', body: 'Review your morning sales and plan for the afternoon!' }
            ],
            evening: [
                { title: '🌙 Evening Check-in', body: 'Record all sales before closing!' },
                { title: '📝 End of Day', body: 'Don\'t forget to update your stock!' },
                { title: '✅ Daily Summary', body: 'Review today\'s sales and stock changes!' }
            ],
            monday_motivation: [
                { title: '💪 New Week, New Goals!', body: 'Make this week amazing for your business!' },
                { title: '🚀 Week Ahead!', body: 'Plan your stock management for success!' },
                { title: '🎯 Monday Motivation', body: 'Set your weekly targets today!' }
            ],
            business_tip: [
                { title: '💡 Business Tip', body: 'Review your top 10 products for better insights!' },
                { title: '📊 Smart Management', body: 'Check profit margins on bestsellers!' },
                { title: '🎓 Pro Tip', body: 'Regular stock audits prevent losses!' }
            ],
            inactive_alert: [
                { title: '👋 We Miss You!', body: 'You haven\'t checked your stock in {days} days!' }
            ],
            low_stock: [
                { title: '⚠️ Low Stock Alert', body: '{count} items need restocking!' }
            ]
        },
        fr: {
            morning: [
                { title: '🌅 Bonjour!', body: 'Commencez votre journée en vérifiant les niveaux de stock!' },
                { title: '☀️ Levez-vous et brillez!', body: 'Votre entreprise vous attend! Vérifiez l\'inventaire maintenant.' },
                { title: '📈 Mise à jour matinale', body: 'Prêt à gérer votre stock aujourd\'hui?' }
            ],
            midday_reminder: [
                { title: '☀️ Vérification après-midi', body: 'Comment se passent vos ventes aujourd\'hui?' },
                { title: '📊 Mise à jour de mi-journée', body: 'Il est temps de vérifier vos niveaux de stock et vos ventes!' },
                { title: '💼 Vérification commerciale', body: 'Examinez vos ventes matinales et planifiez l\'après-midi!' }
            ],
            evening: [
                { title: '🌙 Vérification du soir', body: 'Enregistrez toutes les ventes avant la fermeture!' },
                { title: '📝 Fin de journée', body: 'N\'oubliez pas de mettre à jour votre stock!' },
                { title: '✅ Résumé quotidien', body: 'Examinez les ventes et les changements de stock d\'aujourd\'hui!' }
            ],
            monday_motivation: [
                { title: '💪 Nouvelle semaine, nouveaux objectifs!', body: 'Faites de cette semaine une réussite pour votre entreprise!' },
                { title: '🚀 Semaine à venir!', body: 'Planifiez votre gestion de stock pour réussir!' },
                { title: '🎯 Motivation du lundi', body: 'Fixez vos objectifs hebdomadaires aujourd\'hui!' }
            ],
            business_tip: [
                { title: '💡 Conseil commercial', body: 'Examinez vos 10 meilleurs produits pour de meilleures informations!' },
                { title: '📊 Gestion intelligente', body: 'Vérifiez les marges bénéficiaires sur les meilleures ventes!' },
                { title: '🎓 Conseil pro', body: 'Des audits de stock réguliers évitent les pertes!' }
            ],
            inactive_alert: [
                { title: '👋 Vous nous manquez!', body: 'Vous n\'avez pas vérifié votre stock depuis {days} jours!' }
            ],
            low_stock: [
                { title: '⚠️ Alerte stock faible', body: '{count} articles doivent être réapprovisionnés!' }
            ]
        },
        sw: {
            morning: [
                { title: '🌅 Habari za Asubuhi!', body: 'Anza siku yako kwa kuangalia viwango vya bidhaa!' },
                { title: '☀️ Amka na Uangaze!', body: 'Biashara yako inakusubiri! Angalia orodha ya bidhaa sasa.' },
                { title: '📈 Sasisho la Asubuhi', body: 'Uko tayari kusimamia bidhaa zako leo?' }
            ],
            midday_reminder: [
                { title: '☀️ Ukaguzi wa Mchana', body: 'Mauzo yako yanaendeleaje leo?' },
                { title: '📊 Sasisho la Kati ya Siku', body: 'Wakati wa kuangalia viwango vya bidhaa na mauzo yako!' },
                { title: '💼 Ukaguzi wa Biashara', body: 'Kagua mauzo yako ya asubuhi na kupanga mchana!' }
            ],
            evening: [
                { title: '🌙 Ukaguzi wa Jioni', body: 'Rekodi mauzo yote kabla ya kufunga!' },
                { title: '📝 Mwisho wa Siku', body: 'Usisahau kusasisha bidhaa zako!' },
                { title: '✅ Muhtasari wa Siku', body: 'Kagua mauzo na mabadiliko ya bidhaa ya leo!' }
            ],
            monday_motivation: [
                { title: '💪 Wiki Mpya, Malengo Mapya!', body: 'Ifanye wiki hii iwe nzuri kwa biashara yako!' },
                { title: '🚀 Wiki Ijayo!', body: 'Panga usimamizi wako wa bidhaa kwa mafanikio!' },
                { title: '🎯 Motisha ya Jumatatu', body: 'Weka malengo yako ya wiki leo!' }
            ],
            business_tip: [
                { title: '💡 Ushauri wa Biashara', body: 'Kagua bidhaa zako 10 bora kwa ufahamu bora!' },
                { title: '📊 Usimamizi Mwerevu', body: 'Angalia mapato kwenye bidhaa zinazouzwa zaidi!' },
                { title: '🎓 Ushauri wa Kitaalamu', body: 'Ukaguzi wa mara kwa mara wa bidhaa huzuia hasara!' }
            ],
            inactive_alert: [
                { title: '👋 Tumekukumbuka!', body: 'Hujaangalia bidhaa zako kwa siku {days}!' }
            ],
            low_stock: [
                { title: '⚠️ Tahadhari ya Bidhaa Chache', body: '{count} bidhaa zinahitaji kujazwa tena!' }
            ]
        },
        hi: {
            morning: [
                { title: '🌅 सुप्रभात!', body: 'स्टॉक स्तरों की जाँच करके अपना दिन शुरू करें!' },
                { title: '☀️ उठिए और चमकिए!', body: 'आपका व्यवसाय इंतज़ार कर रहा है! अभी इन्वेंट्री जाँचें।' },
                { title: '📈 सुबह का अपडेट', body: 'आज अपने स्टॉक को प्रबंधित करने के लिए तैयार हैं?' }
            ],
            midday_reminder: [
                { title: '☀️ दोपहर की जाँच', body: 'आपकी बिक्री आज कैसी चल रही है?' },
                { title: '📊 मध्याह्न अपडेट', body: 'अपने स्टॉक स्तरों और बिक्री की जाँच करने का समय!' },
                { title: '💼 व्यवसाय जाँच', body: 'अपनी सुबह की बिक्री की समीक्षा करें और दोपहर की योजना बनाएं!' }
            ],
            evening: [
                { title: '🌙 शाम की जाँच', body: 'बंद करने से पहले सभी बिक्री रिकॉर्ड करें!' },
                { title: '📝 दिन का अंत', body: 'अपने स्टॉक को अपडेट करना न भूलें!' },
                { title: '✅ दैनिक सारांश', body: 'आज की बिक्री और स्टॉक परिवर्तनों की समीक्षा करें!' }
            ],
            monday_motivation: [
                { title: '💪 नया सप्ताह, नए लक्ष्य!', body: 'इस सप्ताह को अपने व्यवसाय के लिए अद्भुत बनाएं!' },
                { title: '🚀 आगामी सप्ताह!', body: 'सफलता के लिए अपने स्टॉक प्रबंधन की योजना बनाएं!' },
                { title: '🎯 सोमवार प्रेरणा', body: 'आज अपने साप्ताहिक लक्ष्य निर्धारित करें!' }
            ],
            business_tip: [
                { title: '💡 व्यापार टिप', body: 'बेहतर जानकारी के लिए अपने शीर्ष 10 उत्पादों की समीक्षा करें!' },
                { title: '📊 स्मार्ट प्रबंधन', body: 'बेस्टसेलर पर लाभ मार्जिन जाँचें!' },
                { title: '🎓 प्रो टिप', body: 'नियमित स्टॉक ऑडिट नुकसान को रोकते हैं!' }
            ],
            inactive_alert: [
                { title: '👋 हमें आपकी याद आती है!', body: 'आपने {days} दिनों में अपने स्टॉक की जाँच नहीं की है!' }
            ],
            low_stock: [
                { title: '⚠️ कम स्टॉक अलर्ट', body: '{count} वस्तुओं को फिर से स्टॉक करने की आवश्यकता है!' }
            ]
        },
        ms: {
            morning: [
                { title: '🌅 Selamat Pagi!', body: 'Mulakan hari anda dengan memeriksa tahap stok!' },
                { title: '☀️ Bangkit dan Bersinar!', body: 'Perniagaan anda menanti! Semak inventori sekarang.' },
                { title: '📈 Makluman Pagi', body: 'Bersedia untuk mengurus stok anda hari ini?' }
            ],
            midday_reminder: [
                { title: '☀️ Semakan Petang', body: 'Bagaimana jualan anda hari ini?' },
                { title: '📊 Makluman Tengah Hari', body: 'Masa untuk memeriksa tahap stok dan jualan anda!' },
                { title: '💼 Semakan Perniagaan', body: 'Semak jualan pagi anda dan rancang untuk petang!' }
            ],
            evening: [
                { title: '🌙 Semakan Malam', body: 'Rekod semua jualan sebelum menutup!' },
                { title: '📝 Penghujung Hari', body: 'Jangan lupa untuk mengemas kini stok anda!' },
                { title: '✅ Ringkasan Harian', body: 'Semak jualan dan perubahan stok hari ini!' }
            ],
            monday_motivation: [
                { title: '💪 Minggu Baru, Matlamat Baru!', body: 'Jadikan minggu ini hebat untuk perniagaan anda!' },
                { title: '🚀 Minggu Hadapan!', body: 'Rancang pengurusan stok anda untuk kejayaan!' },
                { title: '🎯 Motivasi Isnin', body: 'Tetapkan sasaran mingguan anda hari ini!' }
            ],
            business_tip: [
                { title: '💡 Tip Perniagaan', body: 'Semak 10 produk teratas anda untuk pandangan yang lebih baik!' },
                { title: '📊 Pengurusan Pintar', body: 'Semak margin keuntungan pada produk terlaris!' },
                { title: '🎓 Tip Profesional', body: 'Audit stok berkala mencegah kerugian!' }
            ],
            inactive_alert: [
                { title: '👋 Kami Rindu Anda!', body: 'Anda tidak memeriksa stok anda selama {days} hari!' }
            ],
            low_stock: [
                { title: '⚠️ Tahap Stok Rendah', body: '{count} item perlu diisi semula!' }
            ]
        },
        ar: {
            morning: [
                { title: '🌅 صباح الخير!', body: 'ابدأ يومك بفحص مستويات المخزون!' },
                { title: '☀️ استيقظ وتألق!', body: 'عملك في انتظارك! تحقق من المخزون الآن.' },
                { title: '📈 تحديث الصباح', body: 'مستعد لإدارة مخزونك اليوم؟' }
            ],
            midday_reminder: [
                { title: '☀️ فتحة الظهيرة', body: 'كيف تسير مبيعاتك اليوم؟' },
                { title: '📊 تحديث منتصف اليوم', body: 'الوقت لفحص مستويات المخزون والمبيعات!' },
                { title: '💼 فحص الأعمال', body: 'راجع مبيعاتك الصباحية وخطط للظهيرة!' }
            ],
            evening: [
                { title: '🌙 فحص المساء', body: 'سجل جميع المبيعات قبل الإغلاق!' },
                { title: '📝 نهاية اليوم', body: 'لا تنس تحديث مخزونك!' },
                { title: '✅ ملخص يومي', body: 'راجع مبيعات اليوم وتغيرات المخزون!' }
            ],
            monday_motivation: [
                { title: '💪 أسبوع جديد، أهداف جديدة!', body: 'اجعل هذا الأسبوع رائعاً لعملك!' },
                { title: '🚀 الأسبوع القادم!', body: 'خطط لإدارة مخزونك لتحقيق النجاح!' },
                { title: '🎯 تحفيز الاثنين', body: 'حدد أهدافك الأسبوعية اليوم!' }
            ],
            business_tip: [
                { title: '💡 نصيحة تجارية', body: 'راجع أفضل 10 منتجات لديك للحصول على رؤى أفضل!' },
                { title: '📊 إدارة ذكية', body: 'تحقق من هوامش الربح على الأكثر مبيعاً!' },
                { title: '🎓 نصيحة محترف', body: 'تدقيق المخزون المنتظم يمنع الخسائر!' }
            ],
            inactive_alert: [
                { title: '👋 نحن نشتاق إليك!', body: 'لم تقم بفحص مخزونك منذ {days} أيام!' }
            ],
            low_stock: [
                { title: '⚠️ تنبيه مخزون منخفض', body: '{count} عناصر تحتاج إلى إعادة تخزين!' }
            ]
        },
        es: {
            morning: [
                { title: '🌅 ¡Buenos días!', body: '¡Comienza tu día revisando los niveles de stock!' },
                { title: '☀️ ¡Levántate y brilla!', body: '¡Tu negocio te espera! Revisa el inventario ahora.' },
                { title: '📈 Actualización matutina', body: '¿Listo para gestionar tu stock hoy?' }
            ],
            midday_reminder: [
                { title: '☀️ Verificación de tarde', body: '¿Cómo van tus ventas hoy?' },
                { title: '📊 Actualización de mediodía', body: '¡Es hora de revisar tus niveles de stock y ventas!' },
                { title: '💼 Verificación de negocio', body: '¡Revisa tus ventas matutinas y planifica la tarde!' }
            ],
            evening: [
                { title: '🌙 Verificación nocturna', body: '¡Registra todas las ventas antes de cerrar!' },
                { title: '📝 Fin del día', body: '¡No olvides actualizar tu stock!' },
                { title: '✅ Resumen diario', body: '¡Revisa las ventas y cambios de stock de hoy!' }
            ],
            monday_motivation: [
                { title: '💪 ¡Nueva semana, nuevas metas!', body: '¡Haz de esta semana algo increíble para tu negocio!' },
                { title: '🚀 ¡Semana por delante!', body: '¡Planifica la gestión de tu stock para el éxito!' },
                { title: '🎯 Motivación para el lunes', body: '¡Establece tus objetivos semanales hoy!' }
            ],
            business_tip: [
                { title: '💡 Consejo de negocio', body: '¡Revisa tus 10 productos principales para mejores perspectivas!' },
                { title: '📊 Gestión inteligente', body: '¡Revisa los márgenes de beneficio en los más vendidos!' },
                { title: '🎓 Consejo profesional', body: '¡Las auditorías periódicas de stock evitan pérdidas!' }
            ],
            inactive_alert: [
                { title: '👋 ¡Te extrañamos!', body: '¡No has revisado tu stock en {days} días!' }
            ],
            low_stock: [
                { title: '⚠️ Alerta de stock bajo', body: '¡{count} artículos necesitan reabastecimiento!' }
            ]
        },
        'zh-CN': {
            morning: [
                { title: '🌅 早安！', body: '从检查库存水平开始新的一天！' },
                { title: '☀️ 起床啦！', body: '您的生意在等着您！立即查看库存。' },
                { title: '📈 早间更新', body: '准备好今天管理您的库存了吗？' }
            ],
            midday_reminder: [
                { title: '☀️ 下午检查', body: '今天的销售情况如何？' },
                { title: '📊 午间更新', body: '是时候检查您的库存水平和销售情况了！' },
                { title: '💼 业务检查', body: '回顾早间销售，规划下午！' }
            ],
            evening: [
                { title: '🌙 晚间检查', body: '关门前记录所有销售！' },
                { title: '📝 日终总结', body: '别忘了更新您的库存！' },
                { title: '✅ 每日总结', body: '回顾今天的销售和库存变化！' }
            ],
            monday_motivation: [
                { title: '💪 新的一周，新的目标！', body: '让这周为您的生意带来精彩！' },
                { title: '🚀 未来一周！', body: '为成功规划您的库存管理！' },
                { title: '🎯 周一动力', body: '今天设定您的每周目标！' }
            ],
            business_tip: [
                { title: '💡 商业小贴士', body: '查看您的十大产品以获得更好的洞察！' },
                { title: '📊 智能管理', body: '检查畅销产品的利润率！' },
                { title: '🎓 专业建议', body: '定期库存审计可防止损失！' }
            ],
            inactive_alert: [
                { title: '👋 我们想您了！', body: '您已经有 {days} 天没有检查库存了！' }
            ],
            low_stock: [
                { title: '⚠️ 低库存警报', body: '{count} 件商品需要补货！' }
            ]
        }
    };
    
    const langMessages = messages[language] || messages.en;
    return langMessages[type] || messages.en[type];
}

// ========================================
// SEND ENGAGEMENT NOTIFICATION
// ========================================
async function sendEngagementNotification(type) {
    try {
        const userLang = await getUserLanguage();
    const messages = getEngagementMessages(type, userLang);

        if (!messages || messages.length === 0) return false; 
        
        const message = Array.isArray(messages) ? 
            messages[Math.floor(Math.random() * messages.length)] : 
            messages;
        
        await self.registration.showNotification(message.title, {
            body: message.body,
            icon: '/image/logo.jpg',
            badge: '/image/200.png',
            vibrate: [200, 100, 200],
            tag: `engagement-${type}`,
            data: {
                type: 'engagement',
                url: '/shop/?from=notification&skip=main',
                timestamp: Date.now(),
                language: userLang
            },
            requireInteraction: type === 'inactive_alert'
        });
        return true;
    } catch (error) {
        console.error('Error sending notification:', error);
        return false;
    }
}

// ========================================
// CHECK LOW STOCK
// ========================================
async function checkLowStockAlert() {
    try {
        const stockData = await getLocalStockData();
        if (!stockData || stockData.length === 0) return;
        
        const lowStockItems = stockData.filter(item => 
            item.quantity <= (item.min_stock || 5)
        );
        
        if (lowStockItems.length > 0) {
            const messages = getEngagementMessages('low_stock');
            const message = { ...messages[0] };
            message.body = message.body.replace('{count}', lowStockItems.length);
            
            await sendEngagementNotification('low_stock');
        }
    } catch (error) {
        debugWarn('Low stock check failed:', error);
    }
}

// ========================================
// CHECK USER INACTIVITY
// ========================================
async function checkUserInactivity() {
    try {
        const lastActivity = await getLastActivityTime();
        const now = Date.now();
        const inactiveHours = (now - lastActivity) / (1000 * 60 * 60);

        if (inactiveHours <= 48) return;

        const engagementData = await getEngagementData();
        const lastSent = engagementData.lastInactiveAlertSentAt || 0;
        const HOUR = 60 * 60 * 1000;

        // Only send once every 7 days, no matter what
        if (now - lastSent < 7 * 24 * HOUR) {
            debugLog('⏭️ Inactive alert already sent recently, skipping');
            return;
        }

        // 🔒 Claim the slot BEFORE sending, to kill any race
        await updateEngagementData({ lastInactiveAlertSentAt: now });

        const messages = getEngagementMessages('inactive_alert');
        const message = { ...messages[0] };
        message.body = message.body.replace('{days}', Math.floor(inactiveHours / 24));

        await sendEngagementNotification('inactive_alert');
    } catch (error) {
        debugWarn('Inactivity check failed:', error);
    }
}

// ========================================
// SCHEDULE NEXT ENGAGEMENT CHECK
// ========================================
// ========================================
// SCHEDULE NEXT ENGAGEMENT CHECK
// ========================================
async function scheduleNextEngagementCheck() {
    try {
        if ('periodicSync' in self.registration) {
            await self.registration.periodicSync.register('engagement-sync', {
                minInterval: 60 * 60 * 1000 // 1 hour
            });
        }
        await self.registration.sync.register('engagement-check');
    } catch (error) {
        // 🔥 SILENTLY IGNORE: Browsers deny Background Sync if the app 
        // isn't installed as a PWA or lacks HTTPS. This is expected behavior.
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
            // Do nothing, this is normal for non-installed web apps
        } else {
            // Only log if it's a different, unexpected error
            debugWarn('⚠️ Could not register background sync:', error);
        }
    }
}
// ========================================
// MAIN ENGAGEMENT CHECKER
// ========================================
let _engagementRunning = false;

async function checkAndSendEngagements() {
    if (_engagementRunning) {
        debugLog('⏭️ Check already running, skipping');
        return;
    }
    _engagementRunning = true;
    try {
       
        
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const today = now.toDateString();
        
        const engagementData = await getEngagementData();
        
        // Morning check (6-9 AM)
        if (hour >= 6 && hour <= 9) {
            const lastMorning = engagementData.lastMorningCheck;
            if (lastMorning !== today) {
                await sendEngagementNotification('morning');
                await updateEngagementData({ lastMorningCheck: today });
            }
        }
        
        // Mid-day check (12-2 PM)
        if (hour >= 12 && hour <= 14) {
            const lastMidday = engagementData.lastMiddayCheck;
            if (lastMidday !== today) {
                await sendEngagementNotification('midday_reminder');
                await updateEngagementData({ lastMiddayCheck: today });
            }
        }
        
        // Evening check (6-9 PM)
        if (hour >= 18 && hour <= 21) {
            const lastEvening = engagementData.lastEveningCheck;
            if (lastEvening !== today) {
                await sendEngagementNotification('evening');
                await updateEngagementData({ lastEveningCheck: today });
            }
        }
        
        // Monday motivation
        if (day === 1 && hour >= 8 && hour <= 12) {
            const weekNum = getWeekNumber(now);
            const lastMonday = engagementData.lastMondayMotivation;
            if (lastMonday !== weekNum) {
                await sendEngagementNotification('monday_motivation');
                await updateEngagementData({ lastMondayMotivation: weekNum });
            }
        }
        
        // Wednesday business tip
        if (day === 3 && hour >= 10 && hour <= 14) {
            const weekNum = getWeekNumber(now);
            const lastWednesday = engagementData.lastWednesdayTip;
            if (lastWednesday !== weekNum) {
                await sendEngagementNotification('business_tip');
                await updateEngagementData({ lastWednesdayTip: weekNum });
            }
        }
        
        await checkLowStockAlert();
        await checkUserInactivity();

       
    } catch (error) {
        console.error('❌ Error in engagement check:', error);
    } finally {
        _engagementRunning = false;
    }
}

// ========================================
// BACKGROUND SYNC EVENTS
// ========================================
// ========================================
// BACKGROUND SYNC EVENTS
// ========================================
self.addEventListener('sync', function(event) {
    if (event.tag === 'engagement-check') {
        event.waitUntil(
            checkAndSendEngagements().catch(err => {
                console.error('❌ Sync engagement check failed, preventing retry loop:', err);
                // Return resolved promise to tell browser "I handled it, don't retry infinitely"
                return Promise.resolve(); 
            })
        );
    }
});

self.addEventListener('periodicsync', function(event) {
    if (event.tag === 'engagement-sync') {
        event.waitUntil(
            checkAndSendEngagements().catch(err => {
                console.error('❌ Periodic sync failed, preventing retry loop:', err);
                return Promise.resolve();
            })
        );
    }
});

// ========================================
// MESSAGE HANDLER
// ========================================
self.addEventListener('message', async function(event) {
    if (!event.data) return;
    
    switch(event.data.type) {
        case 'INIT_ENGAGEMENT_SYSTEM':
          
            event.waitUntil(
                Promise.all([
                    checkAndSendEngagements(),
                    scheduleNextEngagementCheck()
                ])
            );
            break;
            
        case 'UPDATE_LANGUAGE':
            const db = await openEngagementDB();
            const transaction = db.transaction(['engagements'], 'readwrite');
            const store = transaction.objectStore('engagements');
            store.put({ id: 'userLanguage', language: event.data.language });
        
            break;
            
        case 'UPDATE_ACTIVITY':
            const activityDb = await openEngagementDB();
            const activityTransaction = activityDb.transaction(['activity'], 'readwrite');
            const activityStore = activityTransaction.objectStore('activity');
            activityStore.put({ id: 'lastActivity', timestamp: Date.now() });
            await updateEngagementData({ lastInactiveAlertActivity: null });
            break;
            
        case 'UPDATE_STOCK':
            const stockDb = await openEngagementDB();
            const stockTransaction = stockDb.transaction(['stock'], 'readwrite');
            const stockStore = stockTransaction.objectStore('stock');
            await stockStore.clear();
            if (event.data.items) {
                event.data.items.forEach(item => stockStore.put(item));
            }
        
            break;
            
        case 'CHECK_INSTALL_STATUS':
            const clients = await self.clients.matchAll();
            const isInstalled = clients.some(client => 
                client.url.includes(self.location.origin)
            );
            event.source.postMessage({ type: 'INSTALL_STATUS', installed: isInstalled });
            break;
    }
});

debugLog('✅ Engagement Worker ready!');