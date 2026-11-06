// Wrapped in DOMContentLoaded to ensure all HTML elements are ready
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // -------------------- Configuration --------------------
    const WORD_LIMIT = 450;                           // Max words before needing a page break

    // -------------------- State --------------------
    let notesList = [];                                 // Array of note objects
    let currentNoteId = null;                           // ID of the note being edited
    let pendingChanges = false;                          // Track unsaved changes
    let pageLimitActive = false;                         // For word limit UI feedback
    let notesMode = 'list';                              // 'list' or 'edit'
    let lastClickedImg = null;   
                            // Currently selected image

    // -------------------- DOM Elements --------------------
    const notesModal = document.getElementById('notesModal');
    const notesEditor = document.getElementById('notesEditor');
    const notesHeader = document.getElementById('notesHeader');
    const notesWatermark = document.getElementById('notesWatermark');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const printNoteBtn = document.getElementById('printNoteBtn');
    const colorPickerPopup = document.getElementById('colorPickerPopup');
    const colorInput = document.getElementById('colorInput');
    const colorConfirmBtn = document.getElementById('colorConfirmBtn');

    // Buttons that open the modal (assumed to exist globally)
    const openNotesBtn = document.getElementById('openNotesBtn') || document.querySelector('.open-notes-btn');

    // -------------------- Dynamically Created UI Elements --------------------
    // Fixed header container (toolbar + title input)
    const fixedHeaderContainer = document.createElement('div');
    fixedHeaderContainer.className = 'fixed top-0 left-0 right-0 bg-white p-2 shadow-md z-50 flex flex-col';

    // Title input
    const notesTitleInput = document.createElement('input');
    notesTitleInput.type = 'text';
    notesTitleInput.id = 'notesTitleInput';
    notesTitleInput.placeholder = 'add the best title for your notes here.';
    notesTitleInput.className = 'border rounded px-2 py-1 mb-2 font-bold text-lg flex-grow mr-2';
    notesTitleInput.title = 'Enter note title here';
    notesTitleInput.addEventListener('input', function() {
        pendingChanges = true;
    });

    // Toolbar container
    const toolbar = document.createElement('div');
    toolbar.className = 'mb-2 flex flex-wrap gap-1';
    toolbar.style.overflowX = 'auto';
    toolbar.style.overflowY = 'hidden';
    toolbar.style.maxWidth = '100%';
    toolbar.style.paddingBottom = '4px';
    toolbar.style.scrollBehavior = 'smooth';
    toolbar.style.zIndex = '999999999999999999999999999999999999999999999999999999999999999'; // Above the editor but below the modal overlay

    // Return to list button
    const returnToListBtn = document.createElement('button');
    returnToListBtn.textContent = '← Return to List';
    returnToListBtn.className = 'bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded mb-2 font-semibold';
    returnToListBtn.style.display = 'none'; // hidden by default

    // Wrapper for title input and return button
    const titleAndReturnWrapper = document.createElement('div');
    titleAndReturnWrapper.className = 'flex items-center justify-between w-full mb-2';

    // Notes list view
    const notesListView = document.createElement('div');
    notesListView.id = 'notesListView';
    notesListView.style.display = 'none';
    notesListView.style.flexDirection = 'column';
    notesListView.style.gap = '12px';
    notesListView.style.padding = '12px 0';

    const addNoteBtn = document.createElement('button');
    addNoteBtn.innerHTML = '+ New Note';
    addNoteBtn.className = 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mb-2 font-bold';
    addNoteBtn.onclick = function() {
        showNoteEditor(null);
    };

    const notesListContainer = document.createElement('div');
    notesListContainer.id = 'notesListContainer';

    // Assemble list view
    notesListView.appendChild(addNoteBtn);
    notesListView.appendChild(notesListContainer);

    // Insert fixed header into modal content (before first child)
    const modalContent = notesModal.querySelector('.modal-content');
    modalContent.insertBefore(fixedHeaderContainer, modalContent.firstChild);

    // Build toolbar
        fixedHeaderContainer.appendChild(titleAndReturnWrapper);
    titleAndReturnWrapper.appendChild(notesTitleInput);
      titleAndReturnWrapper.appendChild(returnToListBtn);
    fixedHeaderContainer.appendChild(toolbar);

 
  

    // Insert notes list view after fixed header
    modalContent.insertBefore(notesListView, fixedHeaderContainer.nextSibling);

    // -------------------- Helper: Create toolbar button --------------------
    function createToolbarBtn(icon, title, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = icon;
        btn.title = title;
        btn.className = 'bg-white px-2 py-1 rounded hover:bg-blue-200 transition-colors duration-200 text-sm md:text-base flex-shrink-0';
        btn.onclick = onClick;
        return btn;
    }

    // -------------------- Toolbar Buttons --------------------
    toolbar.appendChild(createToolbarBtn('<b>B</b>', 'Bold', () => {
        document.execCommand('bold');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('<i>I</i>', 'Italic', () => {
        document.execCommand('italic');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('<u>U</u>', 'Underline', () => {
        document.execCommand('underline');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('A<sub>A</sub>', 'Subscript', () => {
        document.execCommand('subscript');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('A<sup>A</sup>', 'Superscript', () => {
        document.execCommand('superscript');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('&#8220;S&#8221;', 'Strikethrough', () => {
        document.execCommand('strikeThrough');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('&#128206;', 'Insert Link', () => {
        const url = prompt('Enter URL:');
        if (url) {
            document.execCommand('createLink', false, url);
            notesEditor.focus();
            pendingChanges = true;
        }
    }));

    // Insert Image (with page limit check)
    toolbar.appendChild(createToolbarBtn('&#128247;', 'Insert Image', () => {
        if (isOverWordLimitWithoutManualBreak()) {
            showMessageModal('You have reached the maximum length for one page (' + WORD_LIMIT + ' words). Please insert a manual page break (↵ Page Break) to continue.');
            return;
        }
        showImageInsertDialog();
    }));

    toolbar.appendChild(createToolbarBtn('&#128441;', 'Insert Table', () => {
        document.execCommand('insertHTML', false, '<table border="1" style="width:100%;margin:8px 0;border-collapse:collapse;"><tr><td style="padding:8px;">Cell 1</td><td style="padding:8px;">Cell 2</td></tr><tr><td style="padding:8px;">Cell 3</td><td style="padding:8px;">Cell 4</td></tr></table>');
        notesEditor.focus();
        pendingChanges = true;
    }));

    // Alignment
    toolbar.appendChild(createToolbarBtn('&#8592;', 'Align Left', () => {
        document.execCommand('justifyLeft');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('&#8596;', 'Align Center', () => {
        document.execCommand('justifyCenter');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('&#8594;', 'Align Right', () => {
        document.execCommand('justifyRight');
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('⋮', 'Align Justify', () => {
        document.execCommand('justifyFull');
        notesEditor.focus();
        pendingChanges = true;
    }));

    // Font size
    toolbar.appendChild(createToolbarBtn('A+', 'Increase Font Size', () => {
        document.execCommand('fontSize', false, 5);
        notesEditor.focus();
        pendingChanges = true;
    }));
    toolbar.appendChild(createToolbarBtn('A-', 'Decrease Font Size', () => {
        document.execCommand('fontSize', false, 2);
        notesEditor.focus();
        pendingChanges = true;
    }));

    // -------------------- RESIZE BUTTON WITH EMBEDDED SLIDER --------------------
const resizeBtn = createToolbarBtn('🖼️ Resize', 'Resize Image', (e) => {
    e.stopPropagation();
    if (!lastClickedImg) {
        showMessageModal("Please click an image in the editor first.");
        return;
    }

    const isHidden = resizeSliderWrapper.style.display === 'none';
    
    if (isHidden) {
        resizeSliderWrapper.style.display = 'flex';
        // Sync the slider to the currently selected image
        const currentVal = parseInt(lastClickedImg.style.width) || 100;
        resizeRangeInput.value = currentVal;
        resizePercentVal.textContent = currentVal;
    } else {
        resizeSliderWrapper.style.display = 'none';
    }
});
    resizeBtn.id = 'resizeToolBtn';
    resizeBtn.style.display = 'none'; // Hidden until an image is clicked
    resizeBtn.style.position = 'relative'; // For absolute positioning of slider
    toolbar.appendChild(resizeBtn);

    // Slider wrapper (hidden by default)
// Slider wrapper (now attached to the fixed header)
const resizeSliderWrapper = document.createElement('div');
// Use relative positioning so it sits nicely below the toolbar
resizeSliderWrapper.className = 'bg-gray-50 border-t border-b shadow-inner p-2 flex items-center justify-center gap-4 z-[60]';
resizeSliderWrapper.style.display = 'none'; // Hidden by default
resizeSliderWrapper.style.width = '100%'; // Spans across the top

resizeSliderWrapper.innerHTML = `
    <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Image Width:</span>
        <span class="text-sm font-mono font-bold text-blue-600"><span id="resizePercentVal">100</span>%</span>
    </div>
    <input type="range" id="resizeRangeInput" min="10" max="100" value="100" class="flex-grow max-w-xs cursor-pointer">
    <button onclick="this.parentElement.style.display='none'" class="text-gray-400 hover:text-red-500 text-xs px-2">✕</button>
`;

// IMPORTANT: Append it to the fixed header so it stays at the top
fixedHeaderContainer.appendChild(resizeSliderWrapper);

const resizeRangeInput = resizeSliderWrapper.querySelector('#resizeRangeInput');
const resizePercentVal = resizeSliderWrapper.querySelector('#resizePercentVal');

    // Resize in real-time
    resizeRangeInput.addEventListener('input', (e) => {
        if (!lastClickedImg) return;
        const val = e.target.value;
        resizePercentVal.textContent = val;
        lastClickedImg.style.width = val + '%';
        pendingChanges = true;
    });

    // Prevent clicks inside slider from closing it
    resizeSliderWrapper.addEventListener('click', e => e.stopPropagation());

    // Close slider when clicking outside the button or slider
    document.addEventListener('click', function(e) {
        if (resizeSliderWrapper.style.display === 'flex' &&
            !resizeBtn.contains(e.target) &&
            !resizeSliderWrapper.contains(e.target)) {
            resizeSliderWrapper.style.display = 'none';
        }
    });

    // Text color
    const textColorBtn = createToolbarBtn('&#9728;', 'Text Color', function() {
        showColorPicker(this, 'foreColor');
    });
    toolbar.appendChild(textColorBtn);

    // Background color
    const bgColorBtn = createToolbarBtn('&#11035;', 'Background Color', function() {
        showColorPicker(this, 'hiliteColor');
    });
    toolbar.appendChild(bgColorBtn);

    // Page break
    toolbar.appendChild(createToolbarBtn('↵ Page Break', 'Insert Page Break', () => {
        document.execCommand('insertHTML', false, `
            <div contenteditable="false" class="page-break my-4 w-full border-t border-dashed border-gray-400 text-center text-sm text-gray-500 relative">
                <span style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:white;padding:0 8px;">PAGE BREAK</span>
            </div>
        `);
        notesEditor.focus();
        pendingChanges = true;
    }));

    // -------------------- Color Picker --------------------
    let currentColorTarget = null;      // 'foreColor' or 'hiliteColor'
    let currentColorButton = null;

    function showColorPicker(buttonElement, command) {
        if (colorPickerPopup.style.display === 'block' && currentColorButton === buttonElement) {
            colorPickerPopup.style.display = 'none';
            currentColorTarget = null;
            currentColorButton = null;
            return;
        }

        const rect = buttonElement.getBoundingClientRect();
        colorPickerPopup.style.position = 'fixed';
        colorPickerPopup.style.top = `${rect.bottom + 4}px`;
        colorPickerPopup.style.left = `${rect.left}px`;
        colorPickerPopup.style.display = 'block';
        colorPickerPopup.style.zIndex = '10001';

        currentColorTarget = command;
        currentColorButton = buttonElement;

        colorInput.focus();
        colorInput.click();  // opens native color picker
    }

    colorConfirmBtn.onclick = () => {
        const color = colorInput.value;
        if (color && currentColorTarget) {
            document.execCommand(currentColorTarget, false, color);
            notesEditor.focus();
            pendingChanges = true;
        }
        colorPickerPopup.style.display = 'none';
        currentColorTarget = null;
        currentColorButton = null;
    };

    colorInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            colorConfirmBtn.click();
        } else if (e.key === 'Escape') {
            colorPickerPopup.style.display = 'none';
            currentColorTarget = null;
            currentColorButton = null;
        }
    });

    // Close color picker when clicking outside
    document.addEventListener('click', function(e) {
        const isColorPickerClick = colorPickerPopup.contains(e.target);
        const isColorButtonClick = e.target.closest('button[title="Text Color"]') || e.target.closest('button[title="Background Color"]');
        if (!isColorPickerClick && !isColorButtonClick && colorPickerPopup.style.display === 'block') {
            colorPickerPopup.style.display = 'none';
            currentColorTarget = null;
            currentColorButton = null;
        }
    });

    // -------------------- Image Insert Dialog --------------------
    function showImageInsertDialog() {
        // Save the cursor position before opening dialog
        notesEditor.focus();
        let savedRange = null;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedRange = selection.getRangeAt(0);
        }

        const dlg = document.createElement('div');
        dlg.className = 'modal-overlay';
        dlg.style.padding = '24px';

        const box = document.createElement('div');
        box.className = 'bg-white p-6 rounded shadow-lg flex flex-col gap-4';
        box.style.minWidth = '280px';

        box.innerHTML = `
            <label>Size: 
                <select id="imgSizeSelect" style="margin-left:4px;">
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100" selected>100%</option>
                    <option value="200">200%</option>
                    <option value="custom">Custom</option>
                </select>
            </label>
            <input id="imgSizeNumber" type="number" value="100" min="10" max="1000" step="10" style="width:80px;" title="Width percentage" />
            <input id="imgFileInput" type="file" accept="/image/*" />
            <div class="flex justify-end gap-2">
                <button id="imgInsertConfirm" class="bg-blue-600 text-white px-3 py-1 rounded">Insert</button>
                <button id="imgInsertCancel" class="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button>
            </div>
        `;

        dlg.appendChild(box);
        document.body.appendChild(dlg);

        const sizeSelect = box.querySelector('#imgSizeSelect');
        const sizeNumber = box.querySelector('#imgSizeNumber');
        const fileInput = box.querySelector('#imgFileInput');
        const confirmBtn = box.querySelector('#imgInsertConfirm');
        const cancelBtn = box.querySelector('#imgInsertCancel');

        sizeSelect.addEventListener('change', () => {
            if (sizeSelect.value === 'custom') {
                sizeNumber.disabled = false;
                sizeNumber.focus();
            } else {
                sizeNumber.value = sizeSelect.value;
                sizeNumber.disabled = true;
            }
        });

        sizeNumber.addEventListener('input', () => {
            const val = sizeNumber.value;
            if (['25','50','75','100','200'].includes(val)) {
                sizeSelect.value = val;
            } else {
                sizeSelect.value = 'custom';
            }
        });

        cancelBtn.onclick = () => {
            document.body.removeChild(dlg);
        };

        confirmBtn.onclick = () => {
            const file = fileInput.files[0];
            if (!file) {
                showMessageModal('Please select an image file.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(evt) {
                notesEditor.focus();

                const img = document.createElement('img');
                img.src = evt.target.result;
                img.style.width = sizeNumber.value + '%';

                if (savedRange) {
                    savedRange.deleteContents();
                    savedRange.insertNode(img);
                    savedRange.setStartAfter(img);
                    savedRange.setEndAfter(img);
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                } else {
                    notesEditor.appendChild(img);
                }

                makeImagesResizable(notesEditor);
                notesEditor.focus();
                pendingChanges = true;
            };
            reader.readAsDataURL(file);
            document.body.removeChild(dlg);
        };

        dlg.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cancelBtn.click();
        });
        sizeSelect.focus();
    }

    // -------------------- Image Click Handling --------------------
    function makeImagesResizable(container) {
        const resizeBtn = document.getElementById('resizeToolBtn');

        container.querySelectorAll('img').forEach((img, index) => {
            if (!img.id) img.id = `editable-img-${Date.now()}-${index}`;

            img.style.userSelect = 'none';
            img.style.cursor = 'pointer';

            img.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Clean up any existing menus
                const existingMenu = document.querySelector('.image-context-menu');
                if (existingMenu) existingMenu.remove();

                // Clear outlines from other images
                container.querySelectorAll('img').forEach(i => i.style.outline = 'none');

                // Set selected image
                lastClickedImg = img;
                img.style.outline = '2px solid #3b82f6';

                // Show Resize button
                if (resizeBtn) resizeBtn.style.display = 'inline-flex';

                // Hide the slider when switching images (optional but nice)
                const slider = document.querySelector('.resize-slider-wrapper');
                if (slider) slider.style.display = 'none';

                // Call your menu creation function if it exists
                if (typeof createImageMenu === 'function') {
                    createImageMenu(e.pageX, e.pageY, img.id);
                }
            };
        });
    }


    function createImageMenu(x, y, imgId) {
        const menu = document.createElement('div');
        menu.className = 'image-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.innerHTML = `
            <button onclick="customResizePrompt('${imgId}')">📏 Resize (%)</button>
            <button onclick="rotateImage('${imgId}')">🔄 Rotate 90°</button>
            <button onclick="cropImage('${imgId}')">✂️ Quick Crop (Square)</button>
            <div class="menu-divider"></div>
            <button onclick="alignImg('${imgId}', 'left')">⬅️ Align Left</button>
            <button onclick="alignImg('${imgId}', 'center')">↔️ Align Center</button>
            <button onclick="alignImg('${imgId}', 'right')">➡️ Align Right</button>
            <div class="menu-divider"></div>
            <button style="color:red;" onclick="deleteImg('${imgId}')">🗑️ Delete Image</button>
        `;
        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', () => menu.remove(), {once:true}), 10);
    }

    window.rotateImage = (id) => {
        const img = document.getElementById(id);
        let deg = parseInt(img.dataset.rotate || 0);
        deg = (deg + 90) % 360;
        img.style.transform = `rotate(${deg}deg)`;
        img.dataset.rotate = deg;
    };

    window.cropImage = (id) => {
        const img = document.getElementById(id);
        if (img.style.clipPath === 'circle(50%)') {
            img.style.clipPath = 'none';
        } else {
            img.style.aspectRatio = '1/1';
            img.style.objectFit = 'cover';
            img.style.clipPath = 'circle(50%)';
        }
    };

    window.alignImg = (id, dir) => {
        const img = document.getElementById(id);
        img.style.display = 'block';
        if (dir === 'left') img.style.margin = '0 auto 0 0';
        else if (dir === 'center') img.style.margin = '0 auto';
        else if (dir === 'right') img.style.margin = '0 0 0 auto';
    };

    window.deleteImg = (id) => {
        if (confirm("Delete this image?")) document.getElementById(id).remove();
    };

    // -------------------- Word Limit Utilities --------------------
    function isOverWordLimitWithoutManualBreak() {
        notesEditor.querySelectorAll('.page-break.auto-page-break').forEach(el => el.remove());

        const hasManualBreak = !!notesEditor.querySelector('.page-break:not(.auto-page-break)');
        if (hasManualBreak) return false;

        const currentText = notesEditor.textContent;
        const words = currentText.match(/\b\w+\b/g) || [];
        return words.length > WORD_LIMIT;
    }

    // -------------------- UI State Management --------------------
    function hideNoteEditorUI() {
        notesEditor.style.display = 'none';
        notesTitleInput.style.display = 'none';
        toolbar.style.display = 'none';
        returnToListBtn.style.display = 'none';
        deleteNoteBtn.style.display = 'none';
        saveNoteBtn.style.display = 'none';
        printNoteBtn.style.display = 'none';
    }

    function showNoteEditorUI() {
        notesEditor.style.display = '';
        notesTitleInput.style.display = '';
        toolbar.style.display = '';
        saveNoteBtn.style.display = '';
        printNoteBtn.style.display = '';
        returnToListBtn.style.display = 'inline-block';
        deleteNoteBtn.style.display = currentNoteId ? 'inline-block' : 'none';
    }

    function showNotesListView() {
        notesMode = 'list';
        notesListView.style.opacity = '0';
        notesListView.style.transition = 'opacity 0.3s ease-in-out';

        setTimeout(() => {
            notesListView.style.display = 'flex';
            hideNoteEditorUI();
            renderNotesList();
            notesListView.style.opacity = '1';
        }, 50);
    }

    function showNoteEditor(note) {
        if (pendingChanges && currentNoteId) {
            if (!confirm('You have unsaved changes. Do you want to discard them?')) {
                return;
            }
        }

        notesMode = 'edit';
        notesListView.style.display = 'none';
        notesEditor.style.opacity = '0';

        setTimeout(() => {
            showNoteEditorUI();
            if (note) {
                notesEditor.innerHTML = note.content;
                notesTitleInput.value = note.title || '';
                currentNoteId = note.id;
            } else {
                notesEditor.innerHTML = '<div><br></div><div><br></div><div><br></div><div><br></div><div><br></div><div><br></div>';
                notesTitleInput.value = '';
                currentNoteId = null;
            }
            pageLimitActive = false;
            pendingChanges = false;
            notesEditor.style.opacity = '1';
            notesEditor.style.transition = 'opacity 0.3s ease-in-out';
            makeImagesResizable(notesEditor);
        }, 100);
    }

    // -------------------- Notes List Rendering --------------------
    function renderNotesList() {
        notesListContainer.innerHTML = '';
        if (!notesList.length) {
            notesListContainer.innerHTML = '<div class="text-gray-500 text-center py-8">No notes yet. Click "+ New Note" to create one.</div>';
            return;
        }
        notesList.forEach(note => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-4 py-3 rounded border mb-2 bg-white hover:bg-blue-50 shadow';
            btn.innerHTML = `<b>${note.title || 'Untitled'}</b><br><span class="text-xs text-gray-500">${new Date(note.updatedAt).toLocaleString()}</span>`;
            btn.onclick = () => showNoteEditor(note);
            notesListContainer.appendChild(btn);
        });
    }



    // -------------------- Event Handlers --------------------
    if (openNotesBtn) {
        openNotesBtn.onclick = async function() {
            notesMode = 'list';
            await loadNotes();
            showNotesListView();
            notesModal.classList.remove('hidden');
               openModal('notesModal');
            updateNotesWatermark();
        };
    }

// -------------------- Supabase Notes API --------------------
const MAX_NOTE_SIZE = 50 * 1024; // 50 KB limit

async function loadNotes() {
    try {
        const client = getSB();
        if (!client) throw new Error('Database not available');

        const userId = await getcurrentUserId();
        if (!userId) {
            console.warn('⚠️ No user ID found');
            notesList = [];
            renderNotesList();
            return;
        }
        
        // 🔥 SECURE FETCH: Get notes in ONE RLS-proof call
        const { data, error } = await client.rpc('get_notes_secure', {
            p_user_id: userId
        });

        if (error) throw error;
        
        notesList = data || [];
        renderNotesList();
        
    } catch (e) {
        console.error('Error loading notes:', e);
        notesList = [];
        renderNotesList();
    }
}

// Update saveNoteBtn handler
saveNoteBtn.onclick = async function() {
    const content = notesEditor.innerHTML;
    let title = notesTitleInput.value.trim() || 
                content.replace(/<[^>]+>/g, '').slice(0, 30) || 
                'Untitled';
    
    // 🔥 Check size limit (50 KB)
    const noteSize = new Blob([content]).size;
    if (noteSize > MAX_NOTE_SIZE) {
        const sizeKB = (noteSize / 1024).toFixed(1);
        showMessageModal(
            `⚠️ Note too large! (${sizeKB} KB)\n\n` +
            `Maximum allowed is 50 KB per note.\n` +
            `Please split into multiple notes or remove some images.`
        );
        return;
    }
    
    const userId = await getcurrentUserId();
    const businessId = await getBusinessId() || currentUser?.business_id;

    const note = {
        id: currentNoteId || crypto.randomUUID(),
        title: title,
        content: content,
        user_id: userId,
        business_id: businessId,
        updated_at: new Date().toISOString()
    };

    try {
        const client = getSB();
        if (!client) throw new Error('Database not available');

        // 🔥 SECURE UPSERT: Create or update note in ONE RLS-proof call
        const { error } = await client.rpc('upsert_note_secure', {
            p_record: note,
            p_user_id: userId,
            p_business_id: businessId
        });

        if (error) throw error;

        await loadNotes();
        pendingChanges = false;
        
        // Show size info in success message
        const sizeKB = (noteSize / 1024).toFixed(1);
        showMessageModal(`✅ Note saved! (${sizeKB} KB)`);
        
        // Track
        if (typeof trackAppEvent === 'function') {
            trackAppEvent('note_saved', { 
                noteId: note.id, 
                size: noteSize,
                title: title 
            });
        }

        showNotesListView();
        
    } catch (e) {
        console.error('Error saving note:', e);
        showMessageModal('Failed to save note. Please try again.');
    }
};

// Update deleteNoteBtn handler
deleteNoteBtn.onclick = async function() {
    if (!currentNoteId) return;
    if (!confirm('Delete this note permanently?')) return;
    
    try {
        const client = getSB();
        if (!client) throw new Error('Database not available');

        const userId = await getcurrentUserId();

        // 🔥 SECURE DELETE: Delete note in ONE RLS-proof call
        const { error } = await client.rpc('delete_note_secure', {
            p_id: currentNoteId,
            p_user_id: userId
        });

        if (error) throw error;

        await loadNotes();
        notesEditor.innerHTML = '';
        currentNoteId = null;
        pageLimitActive = false;
        pendingChanges = false;
        showMessageModal('Note deleted!');
        showNotesListView();
        
    } catch (e) {
        console.error('Error deleting note:', e);
        showMessageModal('Failed to delete note. Please try again.');
    }
};

    returnToListBtn.onclick = function() {
        if (pendingChanges && currentNoteId) {
            if (!confirm('You have unsaved changes. Do you want to discard them?')) {
                return;
            }
        }
        showNotesListView();
    };

    // -------------------- Print Preview --------------------
    function cloneFooter() {
        const f = document.getElementById('printPreviewFooter');
        if (f) {
            const footerClone = f.cloneNode(true);
            footerClone.classList.remove('hidden');
            return footerClone;
        }
        return document.createElement('div');
    }

    async function showNotesPrintPreviewModal() {
        await saveNoteBtn.onclick();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = notesEditor.innerHTML;

        const pages = [];
        let currentPage = document.createElement('div');
        currentPage.className = 'print-preview-page';

        Array.from(tempDiv.childNodes).forEach(node => {
            if (node.classList && node.classList.contains('page-break')) {
                if (typeof cloneFooter === 'function') {
                    currentPage.appendChild(cloneFooter());
                } else if (window.printFooter) {
                    currentPage.appendChild(window.printFooter.cloneNode(true));
                }
                pages.push(currentPage);
                currentPage = document.createElement('div');
                currentPage.className = 'print-preview-page';
            } else {
                currentPage.appendChild(node.cloneNode(true));
            }
        });

        if (typeof cloneFooter === 'function') {
            currentPage.appendChild(cloneFooter());
        } else if (window.printFooter) {
            currentPage.appendChild(window.printFooter.cloneNode(true));
        }
        pages.push(currentPage);

        const wrapper = document.createElement('div');
        pages.forEach(page => wrapper.appendChild(page));

        const printStyle = document.createElement('style');
        printStyle.textContent = `
            @media print {
                body {
                    color: black !important;
                    background-color: white !important;
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                .print-preview-page, .print-preview-page * {
                    color: black !important;
                    background-color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                img, video, canvas {
                    background-color: transparent !important;
                }
            }
        `;
        wrapper.insertBefore(printStyle, wrapper.firstChild);

        hideNoteEditorUI();
        notesModal.classList.add('hidden');

        if (typeof showPrintPreviewModal === 'function') {
            showPrintPreviewModal(wrapper, 'notes');
        } else {
            console.warn('showPrintPreviewModal not found');
        }
    }

    printNoteBtn.onclick = showNotesPrintPreviewModal;

    // -------------------- Editor Events --------------------
    notesEditor.addEventListener('input', function() {
        pendingChanges = true;
    });

    notesEditor.addEventListener('beforeinput', function(e) {
        if (notesMode !== 'edit') return;

        if (isOverWordLimitWithoutManualBreak()) {
            if (e.inputType === 'insertHTML' && typeof e.data === 'string' && e.data.includes('class="page-break"')) {
                pageLimitActive = false;
                pendingChanges = true;
                return;
            }

            e.preventDefault();
            if (!pageLimitActive) {
                showMessageModal('Word limit reached (' + WORD_LIMIT + ' words). Insert a page break to continue.');
                pageLimitActive = true;
            }
        } else {
            pageLimitActive = false;
        }
    });

    notesEditor.removeEventListener('input', window._autoPageBreakListener || (() => {}));
    window._autoPageBreakListener = null;

    // -------------------- Watermark --------------------
    function updateNotesWatermark() {
        if (window.businessInfo && window.businessInfo.logoData) {
            notesWatermark.style.backgroundImage = `url('${window.businessInfo.logoData}')`;
        } else {
            notesWatermark.style.backgroundImage = '';
        }
    }

    // Expose close function globally (used by modal close button)
    window.closeNotesModal = function() {
        if (pendingChanges && currentNoteId) {
            if (!confirm('You have unsaved changes. Do you want to discard them?')) {
                return;
            }
        }
        notesModal.classList.add('hidden');
        notesEditor.innerHTML = '';
        currentNoteId = null;
        notesMode = 'list';
        pageLimitActive = false;
        pendingChanges = false;
         showStockManagement();
    };

    // -------------------- Initial State --------------------
    hideNoteEditorUI();
    showNotesListView();
    notesModal.classList.add('hidden');




    // Inside your click listener for the notesEditor
notesEditor.addEventListener('click', (e) => {
    if (e.target.tagName !== 'IMG') {
        // If they click text, hide the resize slider at the top
        resizeSliderWrapper.style.display = 'none';
        
        // Hide the toolbar button too
        const btn = document.getElementById('resizeToolBtn');
        if (btn) btn.style.display = 'none';
        
        lastClickedImg = null;
        notesEditor.querySelectorAll('img').forEach(i => i.style.outline = 'none');
    }
});
});
