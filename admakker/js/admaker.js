
        // ==================== PRODUCTION-READY AD MAKER ====================
const API_BASE = (() => {
    if (window.location.protocol === 'file:') {
        return 'https://localhost:54221';
    }
    if (window.location.port === '9999') {
        return window.location.origin;
    }
    return `${window.location.protocol}//${window.location.hostname}:54221`;
})();

console.log("📡 App connecting to API via:", API_BASE);;

console.log("📡 App connecting to API via:", API_BASE);  

console.log("📡 App connecting to API via:", API_BASE);

        // Configuration
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_IMAGE_TYPES = ['/image/jpeg', '/image/png', '/image/webp', '/image/gif'];
        const DEFAULT_IMAGE = '/image/placeholder.png';

        // ==================== STATE MANAGEMENT ====================
        let state = {
            shopName: 'IHUBS',
            brand: 'SAMSUNG',
            model: 'Galaxy S24 Ultra',
            price: '$999',
            discount: '10% OFF',
            contactInfo: '📞 +1 234 567 890\n📍 123 Tech Street',
            bgColorStart: '#000000',
            bgColorEnd: '#4f46e5',
            textColor: '#ffffff',
            fontFamily: 'inherit',
            gradientType: 'linear',
            features: [
                '200MP Camera',
                '5000mAh Battery',
                'Snapdragon 8 Gen 3',
                'Dynamic AMOLED 2X',
                '12GB RAM'
            ],
            images: [], // Array for multi-image support (up to 5)
            mainImage: '', // Backward compatibility for single image
            logoImage: ''
        };

        let selectedImageIndex = -1;
        let isDragging = false;
        let dragStartX, dragStartY, dragStartLeft, dragStartTop;

        // DOM Elements
        const elements = {
            shopNameInput: document.getElementById('shop-name'),
            brandInput: document.getElementById('brand-input'),
            modelInput: document.getElementById('model-input'),
            priceInput: document.getElementById('price-input'),
            discountInput: document.getElementById('discount-input'),
            contactInput: document.getElementById('contact-info'),
            bgColorStartInput: document.getElementById('bg-color-start'),
            bgColorEndInput: document.getElementById('bg-color-end'),
            textColorInput: document.getElementById('text-color'),
            gradientTypeSelect: document.getElementById('gradient-type'),
            fontStyleSelect: document.getElementById('font-style'),
            templateSelect: document.getElementById('template-select'),
            randomBtn: document.getElementById('random-gradient-btn'),
            downloadBtn: document.getElementById('download-btn'),
            logoUpload: document.getElementById('logo-upload'),
            brandLogo: document.getElementById('brand-logo'),
            adContainer: document.getElementById('ad-container'),
            adShopName: document.getElementById('ad-shop-name'),
            adBrand: document.getElementById('ad-brand'),
            adModel: document.getElementById('ad-model'),
            adPrice: document.getElementById('ad-price'),
            adDiscount: document.getElementById('ad-discount'),
            adContact: document.getElementById('ad-contact'),
            adFeaturesList: document.getElementById('ad-features-list'),
            adImage: document.getElementById('ad-image'),
            featuresList: document.getElementById('features-list'),
            newFeatureInput: document.getElementById('new-feature-input'),
            addFeatureBtn: document.getElementById('add-feature-btn'),
            imageLayers: document.getElementById('image-layers'),
            imageControls: document.getElementById('image-controls'),
            selectedImageIndex: document.getElementById('selected-image-index'),
            sizeSlider: document.getElementById('image-size-slider'),
            sizeValue: document.getElementById('size-value'),
            rotateSlider: document.getElementById('image-rotate-slider'),
            rotateValue: document.getElementById('rotate-value'),
            opacitySlider: document.getElementById('image-opacity-slider'),
            opacityValue: document.getElementById('opacity-value'),
            bgRemoveText: document.getElementById('bg-remove-text'),
            bgRemoveSpinner: document.getElementById('bg-remove-spinner')
        };

        // Templates
        const templates = {
            cyberpunk: { bgStart: '#2a0b45', bgEnd: '#ff00a8', textColor: '#00f9f9', font: 'modern', gradientType: 'conic' },
            'minimal-white': { bgStart: '#ffffff', bgEnd: '#f5f5f5', textColor: '#333333', font: 'modern', gradientType: 'linear' },
            'amoled-dark': { bgStart: '#000000', bgEnd: '#1a1a1a', textColor: '#ffffff', font: 'modern', gradientType: 'linear' },
            'sunset-grad': { bgStart: '#ff7e5f', bgEnd: '#feb47b', textColor: '#1a1a1a', font: 'modern', gradientType: 'radial' },
            'nature-green': { bgStart: '#1e3c1e', bgEnd: '#4a7856', textColor: '#ffffff', font: 'elegant', gradientType: 'diamond' },
            'tech-blue': { bgStart: '#0f2027', bgEnd: '#203a43', textColor: '#00d2ff', font: 'modern', gradientType: 'linear' },
            'luxury-gold': { bgStart: '#1a1a1a', bgEnd: '#3d3d3d', textColor: '#d4af37', font: 'elegant', gradientType: 'radial' },
            'instagram-pink': { bgStart: '#833ab4', bgEnd: '#fd1d1d', textColor: '#ffffff', font: 'modern', gradientType: 'conic' },
            'matrix': { bgStart: '#000000', bgEnd: '#003b00', textColor: '#00ff41', font: 'modern', gradientType: 'linear' },
            'ocean-wave': { bgStart: '#005aa7', bgEnd: '#00b4d8', textColor: '#ffffff', font: 'elegant', gradientType: 'radial' }
        };

        // Font Map
        const fontMap = {
            default: 'inherit',
            modern: "'Poppins', sans-serif",
            elegant: "'Georgia', serif",
            roboto: "'Roboto', sans-serif",
            montserrat: "'Montserrat', sans-serif",
            lato: "'Lato', sans-serif",
            oswald: "'Oswald', sans-serif",
            raleway: "'Raleway', sans-serif",
            merriweather: "'Merriweather', serif",
            playfair: "'Playfair Display', serif",
            nunito: "'Nunito', sans-serif",
            bangers: "'Bangers', cursive",
            pacifico: "'Pacifico', cursive",
            caveat: "'Caveat', cursive"
        };

        // Gradient Map
        const gradientMap = {
            linear: (start, end) => `linear-gradient(135deg, ${start}, ${end})`,
            radial: (start, end) => `radial-gradient(circle at 30% 50%, ${start}, ${end})`,
            conic: (start, end) => `conic-gradient(from 45deg, ${start}, ${end}, ${start})`,
            diamond: (start, end) => `radial-gradient(ellipse at center, ${start} 0%, ${end} 100%)`,
            stripe: (start, end) => `repeating-linear-gradient(135deg, ${start}, ${start} 20px, ${end} 20px, ${end} 40px)`,
            rainbow: () => `linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)`,
            sunset: () => `linear-gradient(120deg, #ff7e5f, #feb47b, #fd5e53, #f9d423)`,
            ocean: () => `linear-gradient(135deg, #48c6ef, #6f86d6)`,
            midnight: () => `linear-gradient(135deg, #2c3e50, #3498db)`,
            fire: () => `linear-gradient(135deg, #ff512f, #dd2476, #ff512f)`,
            ice: () => `linear-gradient(135deg, #83a4d4, #b6fbff)`
        };

        // ==================== INITIALIZATION ====================
        document.addEventListener('DOMContentLoaded', async () => {
            document.getElementById('back-to-shop-btn')?.addEventListener('click', () => {
                const referrer = document.referrer;
                if (referrer) {
                    const previousPage = new URL(referrer);
                    if (previousPage.origin === window.location.origin &&
                        (previousPage.pathname === '/shop' || previousPage.pathname.startsWith('/shop/'))) {
                        window.history.back();
                        return;
                    }
                }
                window.location.href = '/shop/';
            });

            initializeImageSlots();
            await loadSavedData();
            setupEventListeners();
            renderFeaturesList();
            renderAd();
        });

        function initializeImageSlots() {
            const grid = document.getElementById('image-grid');
            grid.innerHTML = '';
            
            for (let i = 0; i < 5; i++) {
                const card = document.createElement('div');
                card.className = 'image-upload-card';
                card.innerHTML = `
                    <input type="file" id="image-${i}" accept="/image/*" style="display: none;">
                    <img id="preview-${i}" class="upload-preview" src="" alt="Preview">
                    <div class="upload-placeholder">
                        <div style="font-size: 24px; margin-bottom: 5px;">📷</div>
                        <div>Image ${i + 1}</div>
                    </div>
                    <button class="remove-image-btn" onclick="removeImage(${i})">✕</button>
                `;
                
                card.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('remove-image-btn')) {
                        document.getElementById(`image-${i}`).click();
                    }
                });
                
                grid.appendChild(card);
                
                document.getElementById(`image-${i}`).addEventListener('change', (e) => {
                    handleImageUpload(i, e);
                });
            }
        }

  async function loadSavedData() {
  try {
    const adDataRaw = localStorage.getItem('adMakerItem');
    if (!adDataRaw) return;
    const adData = JSON.parse(adDataRaw);

    state.shopName    = adData.business?.name        || state.shopName;
    state.contactInfo = adData.business?.contactInfo || state.contactInfo;
    state.brand       = adData.name                  || state.brand;
    state.model       = adData.subcategory || adData.category || state.model;
    state.price       = adData.price != null ? String(adData.price) : state.price;

    elements.shopNameInput && (elements.shopNameInput.value = state.shopName);
    elements.contactInput  && (elements.contactInput.value  = state.contactInfo);
    elements.brandInput    && (elements.brandInput.value    = state.brand);
    elements.modelInput    && (elements.modelInput.value    = state.model);
    elements.priceInput    && (elements.priceInput.value    = state.price);

    /* ---------- LOGO (correct element) ---------- */
    if (adData.business?.logo) {
      let logoUrl = await loadImageAsBase64(adData.business.logo);
      if (!logoUrl) logoUrl = fixImagePath(adData.business.logo);   // fallback
      state.logoImage = logoUrl;

      const logoPrev = document.getElementById('brand-logo-preview'); // <-- canvas logo
      if (logoPrev) { logoPrev.src = logoUrl; logoPrev.style.display = 'block'; }

      if (elements.brandLogo) {                                     // left tab preview
        elements.brandLogo.src = logoUrl;
        elements.brandLogo.style.display = 'block';
      }
    }

    /* ---------- PRODUCT IMAGE → layer slot 0 ---------- */
    if (adData.image) {
      let dataUrl = await loadImageAsBase64(adData.image);
      if (!dataUrl) dataUrl = fixImagePath(adData.image);            // fallback
      state.mainImage = dataUrl;

      state.images[0] = {
        id: `img-${Date.now()}-0`,
        data: dataUrl,
        width: 200, height: 200,
        left: 20, top: 120,
        rotation: 0, opacity: 1, zIndex: 1
      };

      const prev = document.getElementById('preview-0');
      if (prev) {
        prev.src = dataUrl;
        prev.classList.add('active');
        prev.closest('.image-upload-card')?.classList.add('has-image');
      }

      renderImageLayers();
      selectImage(0);            // shows the right-panel controls
    }
  } catch (err) {
    console.error('Error loading saved data:', err);
    showNotification('Failed to load saved data', 'error');
  }
}

        // ==================== EVENT LISTENERS ====================
        function setupEventListeners() {
            // Brand info
            elements.shopNameInput?.addEventListener('input', (e) => {
                state.shopName = e.target.value;
                if (elements.adShopName) elements.adShopName.textContent = state.shopName;
            });

            elements.brandInput?.addEventListener('input', (e) => {
                state.brand = e.target.value;
                if (elements.adBrand) elements.adBrand.textContent = state.brand;
            });

            elements.modelInput?.addEventListener('input', (e) => {
                state.model = e.target.value;
                if (elements.adModel) elements.adModel.textContent = state.model;
            });

            // Pricing
            elements.priceInput?.addEventListener('input', (e) => {
                state.price = e.target.value;
                if (elements.adPrice) elements.adPrice.textContent = state.price;
            });

            elements.discountInput?.addEventListener('input', (e) => {
                state.discount = e.target.value;
                if (elements.adDiscount) {
                    elements.adDiscount.textContent = state.discount;
                    elements.adDiscount.style.display = state.discount ? 'block' : 'none';
                }
            });

            // Contact
            elements.contactInput?.addEventListener('input', (e) => {
                state.contactInfo = e.target.value;
                if (elements.adContact) {
                    elements.adContact.innerHTML = state.contactInfo.replace(/\n/g, '<br>');
                }
            });

            // Colors
            elements.bgColorStartInput?.addEventListener('input', (e) => {
                state.bgColorStart = e.target.value;
                renderAd();
            });

            elements.bgColorEndInput?.addEventListener('input', (e) => {
                state.bgColorEnd = e.target.value;
                renderAd();
            });

            elements.textColorInput?.addEventListener('input', (e) => {
                state.textColor = e.target.value;
                updateTextColors();
            });

            // Gradient
            elements.gradientTypeSelect?.addEventListener('change', (e) => {
                state.gradientType = e.target.value;
                renderAd();
            });

            // Font
            elements.fontStyleSelect?.addEventListener('change', (e) => {
                state.fontFamily = fontMap[e.target.value] || fontMap.default;
                if (elements.adContainer) {
                    elements.adContainer.style.fontFamily = state.fontFamily;
                }
            });

            // Template
            elements.templateSelect?.addEventListener('change', (e) => {
                const template = templates[e.target.value];
                if (template) {
                    state.bgColorStart = template.bgStart;
                    state.bgColorEnd = template.bgEnd;
                    state.textColor = template.textColor;
                    state.gradientType = template.gradientType;
                    
                    if (elements.bgColorStartInput) elements.bgColorStartInput.value = template.bgStart;
                    if (elements.bgColorEndInput) elements.bgColorEndInput.value = template.bgEnd;
                    if (elements.textColorInput) elements.textColorInput.value = template.textColor;
                    if (elements.gradientTypeSelect) elements.gradientTypeSelect.value = template.gradientType;
                    
                    if (template.font && elements.fontStyleSelect) {
                        elements.fontStyleSelect.value = template.font;
                        state.fontFamily = fontMap[template.font];
                    }
                    
                    renderAd();
                    updateTextColors();
                }
            });

            // Random gradient
            elements.randomBtn?.addEventListener('click', () => {
                const [color1, color2] = getHarmoniousColorPair();
                state.bgColorStart = color1;
                state.bgColorEnd = color2;
                if (elements.bgColorStartInput) elements.bgColorStartInput.value = color1;
                if (elements.bgColorEndInput) elements.bgColorEndInput.value = color2;
                addRandomShapes();
                renderAd();
            });

            // Logo upload
            elements.logoUpload?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file || !validateImageFile(file)) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    state.logoImage = ev.target.result;
                    if (elements.brandLogo) {
                        elements.brandLogo.src = ev.target.result;
                        elements.brandLogo.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            });

            // Features
            elements.addFeatureBtn?.addEventListener('click', () => {
                const feature = elements.newFeatureInput?.value.trim();
                if (feature) {
                    state.features.push(feature);
                    elements.newFeatureInput.value = '';
                    renderFeaturesList();
                    renderAd();
                }
            });

            elements.newFeatureInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    elements.addFeatureBtn?.click();
                }
            });

            // Download
            elements.downloadBtn?.addEventListener('click', handleDownload);

            // Image control sliders
            elements.sizeSlider?.addEventListener('input', (e) => {
                if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
                
                const size = parseInt(e.target.value);
                state.images[selectedImageIndex].width = size;
                state.images[selectedImageIndex].height = size;
                
                const layer = document.getElementById(state.images[selectedImageIndex].id);
                if (layer) {
                    layer.style.width = size + 'px';
                    layer.style.height = size + 'px';
                }
                
                if (elements.sizeValue) elements.sizeValue.textContent = size + 'px';
            });

            elements.rotateSlider?.addEventListener('input', (e) => {
                if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
                
                const rotation = parseInt(e.target.value);
                state.images[selectedImageIndex].rotation = rotation;
                
                const layer = document.getElementById(state.images[selectedImageIndex].id);
                if (layer) {
                    layer.style.transform = `rotate(${rotation}deg)`;
                }
                
                if (elements.rotateValue) elements.rotateValue.textContent = rotation + '°';
            });

            elements.opacitySlider?.addEventListener('input', (e) => {
                if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
                
                const opacity = parseFloat(e.target.value);
                state.images[selectedImageIndex].opacity = opacity;
                
                const layer = document.getElementById(state.images[selectedImageIndex].id);
                if (layer) {
                    layer.style.opacity = opacity;
                }
                
                if (elements.opacityValue) elements.opacityValue.textContent = Math.round(opacity * 100) + '%';
            });
        }

        // ==================== IMAGE HANDLING ====================
        async function handleImageUpload(index, event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!validateImageFile(file)) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    id: `img-${Date.now()}-${index}`,
                    data: e.target.result,
                    width: 150,
                    height: 150,
                    left: 50 + (index * 40),
                    top: 100 + (index * 50),
                    rotation: 0,
                    opacity: 1,
                    zIndex: index + 1
                };

                state.images[index] = imageData;

                const preview = document.getElementById(`preview-${index}`);
                preview.src = e.target.result;
                preview.classList.add('active');
                
                const card = preview.closest('.image-upload-card');
                card.classList.add('has-image');

                renderImageLayers();
                selectImage(index);
            };
            reader.readAsDataURL(file);
        }

        function removeImage(index) {
            if (state.images[index]) {
                delete state.images[index];
                
                const preview = document.getElementById(`preview-${index}`);
                preview.src = '';
                preview.classList.remove('active');
                
                const card = preview.closest('.image-upload-card');
                card.classList.remove('has-image');
                
                document.getElementById(`image-${index}`).value = '';
                
                if (selectedImageIndex === index) {
                    selectedImageIndex = -1;
                    if (elements.imageControls) elements.imageControls.style.display = 'none';
                }
                
                renderImageLayers();
            }
        }

        function validateImageFile(file) {
 

            if (file.size > MAX_IMAGE_SIZE) {
                showNotification(`Image size must be less than ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`, 'error');
                return false;
            }

            return true;
        }

        async function loadImageAsBase64(url) {
            try {
                const response = await fetch(fixImagePath(url));
                const blob = await response.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error('Failed to load image:', error);
                return '';
            }
        }

        function fixImagePath(path) {
            if (!path) return DEFAULT_IMAGE;
            if (path.startsWith('http')) return path;
            if (path.startsWith('data:')) return path;
            return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
        }

        // ==================== IMAGE LAYERS ====================
  function renderImageLayers() {
  if (!elements.imageLayers) return;
  elements.imageLayers.innerHTML = '';

  Object.entries(state.images)
    .filter(([, img]) => img && img.data)
    .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0))
    .forEach(([key, img]) => {
      const idx = Number(key);                       // ← real key, not position

      const layer = document.createElement('div');
      layer.className = `image-layer ${selectedImageIndex === idx ? 'selected' : ''}`;
      layer.id = img.id;
      layer.style.cssText = `
        left:${img.left}px; top:${img.top}px;
        width:${img.width}px; height:${img.height}px;
        opacity:${img.opacity}; transform:rotate(${img.rotation}deg);
        z-index:${img.zIndex || idx + 1};`;

      layer.innerHTML = `<img src="${img.data}" draggable="false" crossorigin="anonymous"><div class="resize-handle"></div>`;

      layer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('resize-handle')) startResize(e, idx);
        else startDrag(e, idx);
      });

      elements.imageLayers.appendChild(layer);
    });
}

        function startDrag(e, index) {
            e.preventDefault();
            selectImage(index);
            
            const layer = e.currentTarget;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartLeft = parseFloat(layer.style.left) || 0;
            dragStartTop = parseFloat(layer.style.top) || 0;
            
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
        }

        function onDrag(e) {
            if (!isDragging || selectedImageIndex === -1) return;
            
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            
            const newLeft = dragStartLeft + dx;
            const newTop = dragStartTop + dy;
            
            if (state.images[selectedImageIndex]) {
                state.images[selectedImageIndex].left = newLeft;
                state.images[selectedImageIndex].top = newTop;
                
                const layer = document.getElementById(state.images[selectedImageIndex].id);
                if (layer) {
                    layer.style.left = newLeft + 'px';
                    layer.style.top = newTop + 'px';
                }
            }
        }

        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        function startResize(e, index) {
            e.preventDefault();
            e.stopPropagation();
            
            selectImage(index);
            
            const layer = e.currentTarget;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseFloat(layer.style.width) || 150;
            const startHeight = parseFloat(layer.style.height) || 150;
            
            function onResize(e) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newSize = Math.max(50, startWidth + dx);
                
                if (state.images[selectedImageIndex]) {
                    state.images[selectedImageIndex].width = newSize;
                    state.images[selectedImageIndex].height = newSize;
                    
                    layer.style.width = newSize + 'px';
                    layer.style.height = newSize + 'px';
                    
                    if (elements.sizeSlider) {
                        elements.sizeSlider.value = newSize;
                        if (elements.sizeValue) elements.sizeValue.textContent = newSize + 'px';
                    }
                }
            }
            
            function stopResize() {
                document.removeEventListener('mousemove', onResize);
                document.removeEventListener('mouseup', stopResize);
            }
            
            document.addEventListener('mousemove', onResize);
            document.addEventListener('mouseup', stopResize);
        }

        function selectImage(index) {
            if (!state.images[index]) return;
            
            selectedImageIndex = index;
            const img = state.images[index];
            
            document.querySelectorAll('.image-layer').forEach(el => {
                el.classList.remove('selected');
            });
            
            const layer = document.getElementById(img.id);
            if (layer) layer.classList.add('selected');
            
            if (elements.imageControls) elements.imageControls.style.display = 'block';
            if (elements.selectedImageIndex) {
                elements.selectedImageIndex.textContent = `Image ${index + 1}`;
            }
            
            // Update sliders
            if (elements.sizeSlider) {
                elements.sizeSlider.value = img.width;
                if (elements.sizeValue) elements.sizeValue.textContent = img.width + 'px';
            }
            if (elements.rotateSlider) {
                elements.rotateSlider.value = img.rotation || 0;
                if (elements.rotateValue) elements.rotateValue.textContent = (img.rotation || 0) + '°';
            }
            if (elements.opacitySlider) {
                elements.opacitySlider.value = img.opacity || 1;
                if (elements.opacityValue) elements.opacityValue.textContent = Math.round((img.opacity || 1) * 100) + '%';
            }
        }

        // ==================== IMAGE MANIPULATION FUNCTIONS ====================
        function alignImage(position) {
            if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
            
            const container = document.getElementById('ad-container');
            const containerRect = container.getBoundingClientRect();
            const img = state.images[selectedImageIndex];
            
            switch(position) {
                case 'left': img.left = 20; break;
                case 'right': img.left = containerRect.width - img.width - 20; break;
                case 'center': img.left = (containerRect.width - img.width) / 2; break;
                case 'top': img.top = 80; break;
                case 'bottom': img.top = containerRect.height - img.height - 80; break;
                case 'middle': img.top = (containerRect.height - img.height) / 2; break;
            }
            
            const layer = document.getElementById(img.id);
            if (layer) {
                layer.style.left = img.left + 'px';
                layer.style.top = img.top + 'px';
            }
        }

        function bringForward() {
            if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
            
            const currentZ = state.images[selectedImageIndex].zIndex || 1;
            state.images[selectedImageIndex].zIndex = currentZ + 1;
            
            renderImageLayers();
            selectImage(selectedImageIndex);
        }

        function sendBackward() {
            if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
            
            const currentZ = state.images[selectedImageIndex].zIndex || 1;
            if (currentZ > 1) {
                state.images[selectedImageIndex].zIndex = currentZ - 1;
                renderImageLayers();
                selectImage(selectedImageIndex);
            }
        }

        function duplicateImage() {
            if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) return;
            
            const original = state.images[selectedImageIndex];
            const newIndex = Object.keys(state.images).length;
            
            const duplicate = {
                ...original,
                id: `img-${Date.now()}-${newIndex}`,
                left: original.left + 30,
                top: original.top + 30,
                zIndex: original.zIndex + 1
            };
            
            state.images[newIndex] = duplicate;
            renderImageLayers();
            selectImage(newIndex);
        }

        function resetAllImages() {
            for (let i = 0; i < 5; i++) {
                removeImage(i);
            }
            selectedImageIndex = -1;
            if (elements.imageControls) elements.imageControls.style.display = 'none';
        }

        // ==================== BACKGROUND REMOVAL ====================
        async function removeBackground() {
            if (selectedImageIndex === -1 || !state.images[selectedImageIndex]) {
                showNotification('Please select an image first', 'warning');
                return;
            }

            if (elements.bgRemoveText) elements.bgRemoveText.textContent = 'Processing...';
            if (elements.bgRemoveSpinner) elements.bgRemoveSpinner.style.display = 'inline-block';

            try {
                const img = state.images[selectedImageIndex];
                const processedImage = await advancedRemoveBackground(img.data);
                
                img.data = processedImage;
                
                const preview = document.getElementById(`preview-${selectedImageIndex}`);
                if (preview) preview.src = processedImage;
                
                const layer = document.getElementById(img.id);
                if (layer) {
                    layer.querySelector('img').src = processedImage;
                }

                showNotification('Background removed successfully!', 'success');
            } catch (error) {
                console.error('Background removal failed:', error);
                showNotification('Background removal failed', 'error');
            } finally {
                if (elements.bgRemoveText) elements.bgRemoveText.textContent = 'Remove Background';
                if (elements.bgRemoveSpinner) elements.bgRemoveSpinner.style.display = 'none';
            }
        }

        async function advancedRemoveBackground(imageSrc) {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = imageSrc;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    // Get background color from corners
                    const corners = [
                        getPixelColor(data, 0, 0, canvas.width),
                        getPixelColor(data, canvas.width - 1, 0, canvas.width),
                        getPixelColor(data, 0, canvas.height - 1, canvas.width),
                        getPixelColor(data, canvas.width - 1, canvas.height - 1, canvas.width)
                    ];
                    
                    const bgColor = {
                        r: Math.round(corners.reduce((sum, c) => sum + c.r, 0) / 4),
                        g: Math.round(corners.reduce((sum, c) => sum + c.g, 0) / 4),
                        b: Math.round(corners.reduce((sum, c) => sum + c.b, 0) / 4)
                    };
                    
                    const threshold = 60;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        const distance = Math.sqrt(
                            Math.pow(r - bgColor.r, 2) +
                            Math.pow(g - bgColor.g, 2) +
                            Math.pow(b - bgColor.b, 2)
                        );
                        
                        if (distance < threshold) {
                            data[i + 3] = 0;
                        }
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas.toDataURL('/image/png'));
                };
            });
        }

        function getPixelColor(data, x, y, width) {
            const index = (y * width + x) * 4;
            return {
                r: data[index],
                g: data[index + 1],
                b: data[index + 2]
            };
        }

        // ==================== FEATURES ====================
        function renderFeaturesList() {
            if (!elements.featuresList || !elements.adFeaturesList) return;

            elements.featuresList.innerHTML = state.features.map((feature, index) => `
                <div class="feature-item">
                    <span class="feature-text">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        ${feature}
                    </span>
                    <button class="feature-delete" onclick="deleteFeature(${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `).join('');

            elements.adFeaturesList.innerHTML = state.features.map(feature => `
                <li>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${state.textColor}" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    ${feature}
                </li>
            `).join('');
        }

        window.deleteFeature = (index) => {
            state.features.splice(index, 1);
            renderFeaturesList();
            renderAd();
        };

        // ==================== RENDERING ====================
        function renderAd() {
            if (!elements.adContainer) return;

            const gradientFn = gradientMap[state.gradientType] || gradientMap.linear;
            elements.adContainer.style.background = gradientFn(state.bgColorStart, state.bgColorEnd);
            
            updateTextColors();
            
            if (elements.adShopName) elements.adShopName.textContent = state.shopName;
            if (elements.adBrand) elements.adBrand.textContent = state.brand;
            if (elements.adModel) elements.adModel.textContent = state.model;
            if (elements.adPrice) elements.adPrice.textContent = state.price;
            if (elements.adDiscount) {
                elements.adDiscount.textContent = state.discount;
                elements.adDiscount.style.display = state.discount ? 'block' : 'none';
            }
            if (elements.adContact) {
                elements.adContact.innerHTML = state.contactInfo.replace(/\n/g, '<br>');
            }
        }

        function updateTextColors() {
            const textElements = document.querySelectorAll('#ad-brand, #ad-model, #ad-shop-name, #ad-contact, #ad-features-list li');
            textElements.forEach(el => {
                el.style.color = state.textColor;
            });
            
            const featureIcons = document.querySelectorAll('#ad-features-list svg');
            featureIcons.forEach(icon => {
                icon.setAttribute('stroke', state.textColor);
            });
        }

        // ==================== SHAPES ====================
        function addRandomShapes() {
            document.querySelectorAll('.random-shape').forEach(el => el.remove());
            if (!elements.adContainer) return;

            const shapeCount = Math.floor(Math.random() * 6) + 6;
            const shapes = ['circle', 'rounded', 'blob'];

            for (let i = 0; i < shapeCount; i++) {
                const shapeType = shapes[Math.floor(Math.random() * shapes.length)];
                const shape = document.createElement('div');
                shape.className = 'random-shape';

                const size = Math.floor(Math.random() * 120) + 80;
                const posX = Math.floor(Math.random() * 90);
                const posY = Math.floor(Math.random() * 90);

                const [c1, c2] = getHarmoniousColorPair();
                const gradientCSS = getGradientCSSForShapes(c1, c2);

                Object.assign(shape.style, {
                    width: size + 'px',
                    height: size + 'px',
                    left: posX + '%',
                    top: posY + '%',
                    opacity: '0.15',
                    background: gradientCSS,
                    borderRadius: shapeType === 'circle' ? '50%' : 
                                shapeType === 'rounded' ? '25%' : 
                                '40% 60% 70% 30% / 40% 30% 70% 60%',
                    animation: `float${Math.floor(Math.random() * 3) + 1} ${15 + Math.random() * 15}s infinite ease-in-out`,
                    animationDelay: Math.random() * 8 + 's'
                });

                elements.adContainer.appendChild(shape);
            }
        }

        function getGradientCSSForShapes(color1, color2) {
            const gradientType = state.gradientType;
            
            switch (gradientType) {
                case 'linear': return `linear-gradient(135deg, ${color1}, ${color2})`;
                case 'radial': return `radial-gradient(circle, ${color1}, ${color2})`;
                case 'conic': return `conic-gradient(from 0deg, ${color1}, ${color2})`;
                case 'diamond': return `radial-gradient(closest-side, ${color1}, ${color2})`;
                default: return `linear-gradient(135deg, ${color1}, ${color2})`;
            }
        }

        // ==================== COLOR UTILITIES ====================
        function getHarmoniousColorPair() {
            const baseHue = Math.floor(Math.random() * 360);
            const secondHue = (baseHue + 30 + Math.floor(Math.random() * 30)) % 360;
            return [hslToHex(baseHue, 70, 55), hslToHex(secondHue, 70, 55)];
        }

        function hslToHex(h, s, l) {
            s /= 100; l /= 100;
            let c = (1 - Math.abs(2 * l - 1)) * s;
            let x = c * (1 - Math.abs((h / 60) % 2 - 1));
            let m = l - c / 2;
            let r = 0, g = 0, b = 0;
            
            if (0 <= h && h < 60) { r = c; g = x; b = 0; }
            else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
            else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
            else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
            else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
            else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
            
            r = Math.round((r + m) * 255);
            g = Math.round((g + m) * 255);
            b = Math.round((b + m) * 255);
            
            return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }

        // ==================== DOWNLOAD ====================
        async function handleDownload() {
            if (!elements.adContainer || !window.html2canvas) {
                showNotification('Required libraries not loaded', 'error');
                return;
            }

            try {
                const canvas = await html2canvas(elements.adContainer, {
                    scale: 2,
                    backgroundColor: null,
                    allowTaint: true,
                    useCORS: true,
                    logging: false
                });

                const link = document.createElement('a');
                link.download = `${state.brand.toLowerCase().replace(/\s/g, '-')}-ad-${Date.now()}.png`;
                link.href = canvas.toDataURL('/image/png');
                link.click();

                showNotification('Ad downloaded successfully!', 'success');
            } catch (error) {
                console.error('Download failed:', error);
                showNotification('Failed to download ad', 'error');
            }
        }

        // ==================== SAVE TEMPLATE ====================
        function saveTemplate() {
            localStorage.setItem('proAdData', JSON.stringify(state));
            showNotification('Template saved successfully!', 'success');
        }

        // ==================== UTILITIES ====================
        function showNotification(message, type = 'info') {
            let notification = document.getElementById('notification-toast');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'notification-toast';
                document.body.appendChild(notification);
            }

            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#6366f1'
            };

            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: ${colors[type] || colors.info};
                color: white;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                z-index: 9999;
                animation: slideIn 0.3s ease;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        // Make functions global
        window.removeImage = removeImage;
        window.alignImage = alignImage;
        window.bringForward = bringForward;
        window.sendBackward = sendBackward;
        window.duplicateImage = duplicateImage;
        window.removeBackground = removeBackground;
        window.resetAllImages = resetAllImages;
        window.saveTemplate = saveTemplate;
        window.downloadAd = handleDownload;
