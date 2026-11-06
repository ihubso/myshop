
   
   let stock = []; 
    let sales = []; 
    let stockHistory = []; 
    let creditSales = []; 
    let reminders = [];
    let currentPayments = [];
    let expenses = [];
    let tasks = [];
 
    let notesList = [];
     let speedHistory = [];
    window.businessInfo = window.businessInfo || {};
    window.sales = window.sales || {};
    
    let wss;
    let currentItemBeingEdited = null;
    let lastSeenSaleTimestamp = null;
    let customReceiptItems = [];
    let reconnectAttempts = 0;

    let users = [
        { username: 'admin', password: 'admin123', role: 'administrator' }
    ];
  var currentUser = null;
    let currentCreditSaleId = null;
    window.addEventListener('offline', () => {
        showMessageModal(translations[currentLanguage]?.offline_message || 'You are offline!');
    });

    window.addEventListener('online', () => {
        showMessageModal(translations[currentLanguage]?.online_message || 'Back online!');
    });
    let isCustomReceipt = false;


    let stockMonitorIntervalId = null;
    let businessInfoPrompted = false;
        let weeklySalesTarget = 0;
    let monthlySalesTarget = 0;
    let currentNoteId = null;
   let suggestionIndex = -1;
   let currentCustomReceiptData = null;
   let hideSoldItems = false; // default state
   let sortOldestFirst = true; // default to oldest → newest
   let year = new Date().getFullYear();
   let selectedItem = null;
   const notificationQueue = [];
let notificationActive = false;



    let selectedYear = new Date().getFullYear();

    const onlineUserSet = new Set();
    const homeOverlay = document.getElementById('homeOverlay');
    const lowStockDot = document.getElementById('lowStockDot'); // NEW: Red dot element
    const mainContentContainer = document.getElementById('mainContentContainer');
    const stockTypeFilter = document.getElementById('stockTypeFilter');




    // Stock Management Elements
    const stockManagementSection = document.getElementById('stockManagementSection');
    const stockOptionsModal = document.getElementById('stockOptionsModal'); // NEW: Stock Options Modal
    const addOptionBtn = document.getElementById('addOptionBtn'); // NEW: Add New Item button in modal
    const currentStockOptionBtn = document.getElementById('currentStockOptionBtn'); // NEW: Current Stock button in modal
    const historyOptionBtn = document.getElementById('historyOptionBtn'); // NEW: Stock History button in modal
    const profitLossOptionBtn = document.getElementById('profitLossOptionBtn'); // MOVED: Profit/Loss Statements button
    const weeklySalesOptionBtn = document.getElementById('weeklySalesOptionBtn'); // NEW: Weekly Sales Report button
    const monthlySalesOptionBtn = document.getElementById('monthlySalesOptionBtn'); // NEW: Monthly Sales Report button


    const addItemSection = document.getElementById('addItemSection'); // NEW: Reference to Add Item section
    const currentStockSection = document.getElementById('currentStockSection'); // NEW: Reference to Current Stock section
    const stockHistorySection = document.getElementById('stock-history-section'); // Already exists
    const profitLossSection = document.getElementById('profitLossSection'); // MOVED: Profit/Loss Section
    const weeklySalesSection = document.getElementById('weeklySalesSection'); // NEW: Weekly Sales Report section
    const monthlySalesSection = document.getElementById('monthlySalesSection'); // NEW: Monthly Sales Report section
    const creditBookOptionBtn = document.getElementById('creditBookOptionBtn'); // NEW: Credit Book button
    const creditSalesSection = document.getElementById('creditSalesSection'); // NEW: Credit Sales Section
    const creditSalesCustomerNameFilter = document.getElementById('creditSalesCustomerNameFilter'); // NEW
    const creditSalesStatusFilter = document.getElementById('creditSalesStatusFilter'); // NEW
    const applyCreditSalesFilterBtn = document.getElementById('applyCreditSalesFilterBtn'); // NEW
    const printCreditSalesBtn = document.getElementById('printCreditSalesBtn'); // NEW
    const creditSalesTableBody = document.getElementById('creditSalesTableBody'); // NEW
    const noCreditSalesMessage = document.getElementById('noCreditSalesMessage'); // NEW
    const salesHistoryPaymentFilter = document.getElementById('salesHistoryPaymentFilter');
    const salesHistoryTypeFilter = document.getElementById('salesHistoryTypeFilter');
    const stockCategoryFilter = document.getElementById('stockCategoryFilter');
    const stockItemSearchInput = document.getElementById('stockItemSearchInput');



    const paymentCreditRadio = document.getElementById('paymentCredit'); // NEW: Credit payment radio
    const creditSaleFields = document.getElementById('creditSaleFields'); // NEW: Credit sale fields container
    const customerNameInput = document.getElementById('customerName'); // NEW: Customer Name input
    const advancePaymentInput = document.getElementById('advancePayment'); // NEW: Advance Payment input

    // New: Item Type radio buttons and labels
    const itemTypeRadios = document.querySelectorAll('input[name="itemType"]');
    const quantityLabel = document.getElementById('quantityLabel');
    const priceLabel = document.getElementById('priceLabel');
    const imageLabel = document.getElementById('imageLabel'); // New
    const itemImageInput = document.getElementById('itemImage'); // New


    const productNameInput = document.getElementById('productName');
    const quantityInput = document.getElementById('quantity');
    const priceInput = document.getElementById('price');
    const barcodeInput = document.getElementById('barcodeInput');
    const addItemQrScannerBtn = document.getElementById('addItemQrScannerBtn');
    const addItemBtn = document.getElementById('addItemBtn');
    const stockTableBody = document.getElementById('stockTableBody');
    const noItemsMessage = document.getElementById('noItemsMessage');

    // Changed to two date inputs for range filter
    const stockHistoryStartDateFilter = document.getElementById('stockHistoryStartDateFilter');
    const stockHistoryEndDateFilter = document.getElementById('stockHistoryEndDateFilter');
    const stockHistoryTableBody = document.getElementById('stockHistoryTableBody');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    const printStockHistoryBtn = document.getElementById('printStockHistoryBtn'); // Print button
    const applyStockFilterBtn = document.getElementById('applyStockFilterBtn'); // NEW: Apply Filter button for stock history
    const categoryInput = document.getElementById('categoryInput'); // Add this at the top with other inputs


    // Sales Management Elements
    const salesManagementSection = document.getElementById('salesManagementSection');
    const salesOptionsModal = document.getElementById('salesOptionsModal'); // NEW: Sales Options Modal
    const recordSaleOptionBtn = document.getElementById('recordSaleOptionBtn'); // NEW: Record New Sale button in modal
    const salesHistoryOptionBtn = document.getElementById('salesHistoryOptionBtn'); // NEW: Sales History button in modal


    const recordNewSaleSection = document.getElementById('recordNewSaleSection'); // NEW: Reference to Record New Sale section
    const salesHistorySection = document.getElementById('sales-history-section'); // Corrected: Added definition here


    const saleProductNameInput = document.getElementById('saleProductName');
   
    const saleProductSuggestions = document.getElementById('saleProductSuggestions'); // Autocomplete suggestions container
    const saleQuantityInput = document.getElementById('saleQuantity');
    const salePriceInput = document.getElementById('salePrice');
    const saleQuantityLabel = document.getElementById('saleQuantityLabel'); // New
    const salePriceLabel = document.getElementById('salePriceLabel'); // New
    const saleProductImageContainer = document.getElementById('saleProductImageContainer'); // New
    const saleDateInput = document.getElementById('saleDate'); // Date input for recording sale
    const selectedProductImage = document.getElementById('selectedProductImage'); // Image display
    const selectedProductNoImage = document.getElementById('selectedProductNoImage'); // No image message
    const paymentTypeRadios = document.querySelectorAll('input[name="paymentType"]');
    const mobileMoneyTypeContainer = document.getElementById('mobileMoneyTypeContainer'); // NEW
    const mobileMoneyTypeInput = document.getElementById('mobileMoneyType'); // NEW

    const salesTableBody = document.getElementById('salesTableBody');
    const noSalesMessage = document.getElementById('noSalesMessage');
    const hybridPaymentFields = document.getElementById('hybridPaymentFields');
    const hybridCashAmount = document.getElementById('hybridCashAmount');
    const hybridMobileAmount = document.getElementById('hybridMobileAmount');
    const hybridCreditAmount = document.getElementById('hybridCreditAmount');
    const hybridMobileType = document.getElementById('hybridMobileType');
    const hybridCustomerName = document.getElementById('hybridCustomerName');

    // New: Date range filters for sales history
    const salesHistoryStartDateFilter = document.getElementById('salesHistoryStartDateFilter');
    const salesHistoryEndDateFilter = document.getElementById('salesHistoryEndDateFilter');
    const printSalesHistoryBtn = document.getElementById('printSalesHistoryBtn'); // New: Print button for sales history
    const applySalesFilterBtn = document.getElementById('applySalesFilterBtn'); // NEW: Apply Filter button for sales history

    const weeklySalesChartCanvas = document.getElementById('weeklySalesChart'); // NEW: Weekly Sales Chart Canvas
    const monthlySalesChartCanvas = document.getElementById('monthlySalesChart'); // NEW: Monthly Sales Chart Canvas
    const printWeeklyReportBtn = document.getElementById('printWeeklyReportBtn'); // NEW: Print Weekly Report button
    const printMonthlyReportBtn = document.getElementById('printMonthlyReportBtn'); // NEW: Print Monthly Report button
    const totalRevenueSpan = document.getElementById('totalRevenue'); // NEW
    const totalCogsSpan = document.getElementById('totalCogs'); // NEW
    const netProfitLossSpan = document.getElementById('netProfitLoss'); // NEW
    const printProfitLossReportBtn = document.getElementById('printProfitLossReportBtn'); // NEW


    // Modals
    const itemDetailsModal = document.getElementById('itemDetailsModal');
    // Item Details View Mode Elements
    const itemDetailsViewMode = document.getElementById('itemDetailsViewMode');
    const modalProductNameView = document.getElementById('modalProductNameView');
    const modalTypeView = document.getElementById('modalTypeView'); // New
    const modalProductImageView = document.getElementById('modalProductImageView');
    const modalProductImageViewContainer = document.getElementById('modalProductImageViewContainer'); // New
    const modalNoImageViewMessage = document.getElementById('modalNoImageViewMessage');
    const modalQuantityView = document.getElementById('modalQuantityView');
    const modalQuantityLabelView = document.getElementById('modalQuantityLabelView'); // New
    const modalPriceView = document.getElementById('modalPriceView');
    const modalPriceLabelView = document.getElementById('modalPriceLabelView'); // New
    const modalDateAddedView = document.getElementById('modalDateAddedView');
    const editItemDetailsBtn = document.getElementById('editItemDetailsBtn'); // New: Edit button in view mode

    // Item Details Edit Mode Elements
    const itemDetailsEditMode = document.getElementById('itemDetailsEditMode');
    const editProductNameInput = document.getElementById('editProductName');
    const editItemType = document.getElementById('editItemType'); // New
    const editQuantityInput = document.getElementById('editQuantity');
    const editQuantityLabel = document.getElementById('editQuantityLabel'); // New
    const editPriceInput = document.getElementById('editPrice');
    const editPriceLabel = document.getElementById('editPriceLabel'); // New
    const editProductCurrentImage = document.getElementById('editProductCurrentImage');
    const editItemImageContainer = document.getElementById('editItemImageContainer'); // New
    const editNoCurrentImageMessage = document.getElementById('editNoCurrentImageMessage');
    const editItemImageInput = document.getElementById('editItemImage');
    const editDateAddedSpan = document.getElementById('editDateAdded');
    const updateItemButton = document.getElementById('updateItemBtn');
    const cancelEditItemBtn = document.getElementById('cancelEditItemBtn'); // New: Cancel button in edit mode




    const messageModal = document.getElementById('messageModal');
    const messageModalText = document.getElementById('messageModalText');

    // Confirmation Modal Elements
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationModalText = document.getElementById('confirmationModalText');
    const confirmYesBtn = document.getElementById('confirmYesBtn');
    const confirmNoBtn = document.getElementById('confirmNoBtn');
    const costPriceInput = document.getElementById('costPrice'); // Add this at the top with other inputs


    // Business Settings Modal Elements
    const businessSettingsModal = document.getElementById('businessSettingsModal');
    const businessNameInput = document.getElementById('businessNameInput');
    const addressInput = document.getElementById('addressInput'); // New
    const shopNumberInput = document.getElementById('shopNumberInput');
    const phoneNumberTwoInput = document.getElementById('phoneNumberTwoInput'); // New
    const emailInput = document.getElementById('emailInput'); // New
       const WebsiteInput = document.getElementById('WebsiteInput'); // New
    const socialMediaHandlesInput = document.getElementById('socialMediaHandlesInput'); // New
    const logoFileInput = document.getElementById('logoFileInput'); // Changed from logoUrlInput
    const logoPreview = document.getElementById('logoPreview');
    const saveBusinessSettingsBtn = document.getElementById('saveBusinessSettingsBtn');
    const businessDetailsInput = document.getElementById('businessDetailsInput'); // New

    // Receipt Modal Elements
    const receiptModal = document.getElementById('receiptModal');
    const receiptBusinessLogo = document.getElementById('receiptBusinessLogo');
    const receiptBusinessName = document.getElementById('receiptBusinessName');
    const receiptBusinessAddress = document.getElementById('receiptBusinessAddress');
    const receiptBusinessContact = document.getElementById('receiptBusinessContact');
    const receiptBusinessSocial = document.getElementById('receiptBusinessSocial');
    const receiptSaleId = document.getElementById('receiptSaleId');
    const receiptDate = document.getElementById('receiptDate');
    const receiptItemsTableBody = document.getElementById('receiptItemsTableBody');
    const receiptTotalAmount = document.getElementById('receiptTotalAmount');
    const receiptPaymentType = document.getElementById('receiptPaymentType');
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    const receiptBusinessDetails = document.getElementById('receiptBusinessDetails'); // Added this line

    // Watermark Overlay
    const watermarkOverlay = document.getElementById('watermarkOverlay');

    // Print Header/Footer Elements
    const printHeader = document.getElementById('printHeader');
    const printLogo = document.getElementById('printLogo');
    const printBusinessName = document.getElementById('printBusinessName');
    const printBusinessDetails = document.getElementById('printBusinessDetails'); // Add this line
    const printFooter = document.getElementById('printFooter');
    const printShopNumber = document.getElementById('printShopNumber');
    const printShopAddressDiv = document.getElementById('printShopAddress'); // New
    const printShopContactDiv = document.getElementById('printShopContact'); // New
    const printShopSocialDiv = document.getElementById('printShopSocial'); // New

    // NEW: Print Preview Modal Elements
    const printPreviewModal = document.getElementById('printPreviewModal');
    const printPreviewHeader = document.getElementById('printPreviewHeader');
    const printPreviewBody = document.getElementById('printPreviewBody');
    const printPreviewFooter = document.getElementById('printPreviewFooter');
    const executePrintBtn = document.getElementById('executePrintBtn');
  const groupedBySubcategorySection = document.getElementById('groupedBySubcategorySection');
    const refundSection = document.getElementById('refundHistoryModal');
      const notifBellBtn = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifList = document.getElementById('notifList');
     const searchItems = document.getElementById('searchItems');
    const notifCount = document.getElementById('notifCount');
    const notifCloseDropdown = document.getElementById('notifCloseDropdown');

const notesModal = document.getElementById('notesModal');
const openNotesBtn = document.getElementById('openNotesBtn');
const notesEditor = document.getElementById('notesEditor');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const printNoteBtn = document.getElementById('printNoteBtn');
const savedNotesSelect = document.getElementById('savedNotesSelect');
const loadNoteBtn = document.getElementById('loadNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const insertTableBtn = document.getElementById('insertTableBtn');
const insertImageBtn = document.getElementById('insertImageBtn');
const notesWatermark = document.getElementById('notesWatermark');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const progressTextNode = document.getElementById('weeklyTargetProgressText');
const progressTextNode2 = document.getElementById('weeklyTargetProgressText2');
const personalloanModal = document.getElementById('personalloanModal');
const personalloanManagementBtn = document.getElementById('personalloanManagementBtn');
const personalloanList = document.getElementById('personalloanList');
const personalloanStats = document.getElementById('personalloanStats');
const personalloanModalBg = document.getElementById('personalloanModalBg');

// NEW Add personalloan Modal elements
const addpersonalloanModal = document.getElementById('addpersonalloanModal');
const openAddpersonalloanModalBtn = document.getElementById('openAddpersonalloanModalBtn');
const addpersonalloanForm = document.getElementById('addpersonalloanForm');
const addpersonalloanBtn = document.getElementById('addpersonalloanBtn');
const personalloanWhoInput = document.getElementById('personalloanWho');
const personalloanAmountInput = document.getElementById('personalloanAmount');
const personalloanReasonInput = document.getElementById('personalloanReason');
const personalloanDateInput = document.getElementById('personalloanDate');
const personalloanPaymentDayInput = document.getElementById('personalloanPaymentDay');

// Payment Modal elements
const paymentModal = document.getElementById('paymentModal');
const recordPaymentForm = document.getElementById('recordPaymentForm');
const paymentpersonalloanDetails = document.getElementById('paymentpersonalloanDetails');
const currentpersonalloanId = document.getElementById('currentpersonalloanId');
const paymentAmountInput = document.getElementById('paymentAmount');
const paymentDateInput = document.getElementById('paymentDate');
const markAsPaidCheckbox = document.getElementById('markAsPaidCheckbox');
const markAsPaidContainer = document.getElementById('markAsPaidContainer');
const personalloanSalesChartCanvas = document.getElementById('personalloanSalesChart');


const warrantyDurationInput = document.getElementById('warrantyDurationInput');
    const warrantyUnitSelect = document.getElementById('warrantyUnitSelect');
    const warrantyTextInput = document.getElementById('warrantyTextInput');
       const cashierElement = document.getElementById('receiptCashierName');
       const startDateEl = document.getElementById('weeklySalesStartDate');
    const endDateEl = document.getElementById('weeklySalesEndDate');
    const toggleThemeBtn = document.getElementById('toggleThemeBtn');
    let nightMode = true;




const possibilityScoreDiv = document.getElementById('repaymentPossibilityScore');
 const receiptfooter = document.getElementById('receiptfooter');
const receiptfooter2 = document.getElementById('receiptfooter2');
        if (homeOverlay) {
            homeOverlay.addEventListener('click', handleSecretClick);
        }
        const seeMoreBtn = document.getElementById('seeMoreRemindersBtn');
        if (seeMoreBtn) {
            seeMoreBtn.addEventListener('click', openAllRemindersModal);
        }
        const seeMoreTasksBtn = document.getElementById('seeMoreTasksBtn');
        if (seeMoreTasksBtn) {
            seeMoreTasksBtn.addEventListener('click', openAllTasksModal);
        }
                const menuBtn = document.getElementById('printPreviewMenuBtn');
        const menuDropdown = document.getElementById('printPreviewMenuDropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.onclick = function (e) {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
            };
            document.addEventListener('click', function (e) {
                if (!menuDropdown.contains(e.target) && e.target !== menuBtn) {
                    menuDropdown.classList.add('hidden');
                }
            });
        }
        const dateInput = document.getElementById('customReceiptDateFilter');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }
        const bar = document.getElementById('saleNotificationBar');
        const closenon = document.getElementById('notifCloseBtn');
        if (bar) {
            bar.addEventListener('click', async function(e) {
                if (e.target === closenon || closenon.contains(e.target)) return;
                bar.classList.remove('show');
                if (window.notificationTimeout) clearTimeout(window.notificationTimeout);
                cleanupMemory();
                await showSalesHistorySection();
            });
        }

var currentAnalyticsItemId = window.currentAnalyticsItemId;
let currentAnalyticsYear = new Date().getFullYear();




if (toggleThemeBtn) {
    toggleThemeBtn.onclick = function() {
        nightMode = !nightMode;
        document.body.classList.toggle('night-mode', nightMode);
        toggleThemeBtn.textContent = nightMode ? '☀️ Light Mode' : 'Night Mode 🌙';
        localStorage.setItem('nightMode', nightMode ? '1' : '0');
    };
}



  

// Add this once at the top
function fixImagePath(path) {
    if (!path) return '';
    
    // Already absolute URL (Supabase signed URLs, external URLs)
    if (path.startsWith('http')) return path;
    
    // Base64 encoded images
    if (path.startsWith('data:')) return path;
    
    // Supabase storage public URLs
    if (path.includes('storage/v1/object/public')) return path;
    
    // Local assets - return as-is (works in browser context)
    return path;
}