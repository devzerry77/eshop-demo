/* ─── ADMIN MEDIA: product sections, specs, media gallery (DNS: Drag-N-Sort) ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, showToast, escapeHTML, isYouTubeUrl, getYouTubeThumbnail, isValidUrl } = admin;

    let mediaSortableInstance = null;

    // ─── SECTIONS ──────────────────────────────────────────
    let sectionCounter = 0;
    function createSectionBlock(type = 'custom', label = '', content = '', enabled = true) {
        const id = `section_${sectionCounter++}`;
        const wrapper = document.createElement('div');
        wrapper.className = 'section-block';
        wrapper.dataset.sectionId = id;
        wrapper.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:10px; background:var(--secondary-bg);';
        wrapper.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <span class="drag-handle" style="cursor:grab; color:var(--text-secondary);">⠿</span>
                    <input type="text" class="section-label" value="${escapeHTML(label)}" placeholder="Section Label" style="background:transparent; border:1px solid var(--border); padding:4px 8px; border-radius:4px; flex:1;">
                </div>
                <div style="display:flex; gap:6px;">
                    <label style="display:flex; align-items:center; gap:4px; font-size:12px;">
                        <input type="checkbox" class="section-enabled" ${enabled ? 'checked' : ''}> Active
                    </label>
                    <button type="button" class="mini-button remove-section" style="background:var(--danger); color:#fff;">✕</button>
                </div>
            </div>
            <textarea class="section-content" rows="3" placeholder="Section content (supports HTML, line breaks, bullets)" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--input-bg); color:var(--input-text);">${escapeHTML(content)}</textarea>
            <div class="section-preview" style="margin-top:6px; padding:6px; border:1px solid var(--border); border-radius:4px; background:var(--card-bg); font-size:14px; display:none;"></div>
            <button type="button" class="mini-button preview-section" style="margin-top:4px;">Preview</button>
        `;
        const previewBtn = wrapper.querySelector('.preview-section');
        const previewDiv = wrapper.querySelector('.section-preview');
        previewBtn.addEventListener('click', () => {
            const content = wrapper.querySelector('.section-content').value;
            previewDiv.innerHTML = formatDescription(content);
            previewDiv.style.display = previewDiv.style.display === 'none' ? 'block' : 'none';
        });
        wrapper.querySelector('.remove-section').addEventListener('click', () => {
            wrapper.remove();
            reorderSections();
        });
        return wrapper;
    }

    function formatDescription(text) {
        if (!text) return '';
        const lines = text.split('\n');
        let html = '';
        let inList = false;
        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li>${escapeHTML(trimmed.substring(2))}</li>`;
            } else {
                if (inList) { html += '</ul>'; inList = false; }
                if (trimmed) html += `<p>${escapeHTML(trimmed)}</p>`;
                else html += '<br>';
            }
        }
        if (inList) html += '</ul>';
        return html;
    }

    function getSectionsData() {
        const blocks = DOM.sectionsContainer.querySelectorAll('.section-block');
        const data = [];
        blocks.forEach(block => {
            const label = block.querySelector('.section-label').value.trim() || 'Untitled';
            const content = block.querySelector('.section-content').value;
            const enabled = block.querySelector('.section-enabled').checked;
            data.push({ label, content, enabled });
        });
        return data;
    }

    function setSectionsData(sections) {
        DOM.sectionsContainer.innerHTML = '';
        if (!sections || !sections.length) {
            const defaults = [
                { label: 'Description', content: '', enabled: true },
                { label: 'Specifications', content: '', enabled: true },
                { label: 'Features', content: '- Feature 1\n- Feature 2', enabled: true },
                { label: 'Highlights', content: '- Highlight 1\n- Highlight 2', enabled: true },
                { label: 'Warranty', content: '1-year manufacturer warranty', enabled: true },
                { label: 'Shipping', content: 'Free delivery all over Bangladesh', enabled: true },
                { label: 'Returns', content: '7-day easy return policy', enabled: true },
                { label: 'What\'s in the Box', content: '- 1 × Product\n- 1 × Manual', enabled: true },
                { label: 'FAQ', content: 'Q: Is this authentic?\nA: Yes, 100% genuine.', enabled: true },
            ];
            defaults.forEach(s => {
                DOM.sectionsContainer.appendChild(createSectionBlock('custom', s.label, s.content, s.enabled));
            });
        } else {
            sections.forEach(s => {
                DOM.sectionsContainer.appendChild(createSectionBlock('custom', s.label, s.content, s.enabled));
            });
        }
        reorderSections();
        initSortableSections();
    }

    function reorderSections() {}
    function initSortableSections() {
        if (window.Sortable) {
            new Sortable(DOM.sectionsContainer, {
                handle: '.drag-handle',
                animation: 150,
                onEnd: () => {}
            });
        }
    }

    // ─── SPECS ─────────────────────────────────────────────
    function getSpecs() {
        const groups = DOM.specsContainer.querySelectorAll('.spec-group');
        const specs = {};
        groups.forEach(group => {
            const key = group.querySelector('.spec-key').value.trim();
            const value = group.querySelector('.spec-value').value.trim();
            if (key) specs[key] = value;
        });
        return specs;
    }

    function setSpecs(specs) {
        DOM.specsContainer.innerHTML = '';
        if (!specs || Object.keys(specs).length === 0) {
            addSpecGroup('', '');
        } else {
            Object.entries(specs).forEach(([k, v]) => addSpecGroup(k, v));
        }
    }

    function addSpecGroup(key = '', value = '') {
        const group = document.createElement('div');
        group.className = 'spec-group';
        group.style.cssText = 'display:flex; gap:8px; margin-bottom:6px;';
        group.innerHTML = `
            <input type="text" class="spec-key" placeholder="Key" value="${escapeHTML(key)}" style="flex:1;">
            <input type="text" class="spec-value" placeholder="Value" value="${escapeHTML(value)}" style="flex:1;">
            <button type="button" class="mini-button remove-spec" style="background:var(--danger); color:#fff;">✕</button>
        `;
        group.querySelector('.remove-spec').addEventListener('click', () => {
            group.remove();
        });
        DOM.specsContainer.appendChild(group);
    }

    // ─── MEDIA GALLERY (Images + YouTube) ──────────────────
    function getMediaItems() {
        const wrappers = DOM.imageInputsWrapper.querySelectorAll('.image-input-group');
        const items = [];
        wrappers.forEach(wrapper => {
            const input = wrapper.querySelector('.media-url-input');
            const orderInput = wrapper.querySelector('.media-order-input');
            if (input && orderInput) {
                const url = input.value.trim();
                if (url && isValidUrl(url)) {
                    items.push({
                        url: url,
                        order: parseInt(orderInput.value) || 0
                    });
                }
            }
        });
        return items;
    }

    function getMediaUrls() {
        const items = getMediaItems();
        items.sort((a, b) => a.order - b.order);
        return items.map(item => item.url);
    }

    function getMediaObjects() {
        const items = getMediaItems();
        items.sort((a, b) => a.order - b.order);
        return items.map(item => ({
            url: item.url,
            type: isYouTubeUrl(item.url) ? 'youtube' : 'image'
        }));
    }

    function setMediaItems(items) {
        DOM.imageInputsWrapper.innerHTML = '';
        if (!items || items.length === 0) {
            addMediaInput('', 1);
        } else {
            const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
            sorted.forEach((item, index) => {
                const order = item.order !== undefined ? item.order : index + 1;
                addMediaInput(item.url, order);
            });
        }
        updateGalleryPreview();
        initMediaSortable();
    }

    function addMediaInput(url = '', order = 0) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-input-group';
        wrapper.style.cssText = 'display:flex; gap:6px; align-items:center; margin-bottom:8px; flex-wrap:wrap;';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '⠿';
        dragHandle.style.cssText = 'cursor:grab; color:var(--text-secondary); padding:4px; font-size:18px;';

        const input = document.createElement('input');
        input.type = 'url';
        input.className = 'media-url-input';
        input.placeholder = 'Paste image or YouTube URL';
        input.value = url || '';
        input.style.flex = '1';
        input.style.minWidth = '120px';

        const preview = document.createElement('div');
        preview.className = 'media-preview';
        preview.style.cssText = 'width:50px; height:50px; border-radius:6px; border:1px solid var(--border); overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--secondary-bg); flex-shrink:0;';

        const orderInput = document.createElement('input');
        orderInput.type = 'number';
        orderInput.className = 'media-order-input';
        orderInput.min = '1';
        orderInput.step = '1';
        orderInput.value = order || 1;
        orderInput.style.cssText = 'width:55px; text-align:center; padding:4px; font-size:12px; flex-shrink:0;';

        const orderBtns = document.createElement('div');
        orderBtns.style.cssText = 'display:flex; gap:2px; flex-shrink:0;';
        const btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.textContent = '↑';
        btnUp.className = 'mini-button';
        btnUp.style.cssText = 'padding:2px 6px; font-size:12px;';
        const btnDown = document.createElement('button');
        btnDown.type = 'button';
        btnDown.textContent = '↓';
        btnDown.className = 'mini-button';
        btnDown.style.cssText = 'padding:2px 6px; font-size:12px;';
        const btnFirst = document.createElement('button');
        btnFirst.type = 'button';
        btnFirst.textContent = '⏮';
        btnFirst.className = 'mini-button';
        btnFirst.style.cssText = 'padding:2px 6px; font-size:12px;';
        const btnLast = document.createElement('button');
        btnLast.type = 'button';
        btnLast.textContent = '⏭';
        btnLast.className = 'mini-button';
        btnLast.style.cssText = 'padding:2px 6px; font-size:12px;';
        orderBtns.append(btnUp, btnDown, btnFirst, btnLast);

        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.className = 'button button-secondary';
        uploadBtn.textContent = '📤 Upload';
        uploadBtn.style.cssText = 'padding:4px 10px; font-size:12px; white-space:nowrap;';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.className = 'imgbb-file-input';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'button button-danger';
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'padding:4px 10px; font-size:12px;';

        wrapper.append(dragHandle, input, preview, orderInput, orderBtns, uploadBtn, fileInput, removeBtn);

        function updatePreview() {
            const val = input.value.trim();
            if (!val) {
                preview.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">?</span>';
                return;
            }
            if (isYouTubeUrl(val)) {
                const thumb = getYouTubeThumbnail(val);
                if (thumb) {
                    preview.innerHTML = `
                        <div style="position:relative; width:100%; height:100%;">
                            <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position:absolute; inset:0; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:20px; color:#fff;">▶</div>
                        </div>
                    `;
                } else {
                    preview.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">❌</span>';
                }
            } else if (isValidUrl(val)) {
                preview.innerHTML = `<img src="${val}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.textContent='❌';">`;
            } else {
                preview.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">?</span>';
            }
        }

        function updateOrderNumber() {
            const allOrderInputs = DOM.imageInputsWrapper.querySelectorAll('.media-order-input');
            allOrderInputs.forEach((inp, idx) => {
                inp.value = idx + 1;
            });
        }

        function reorderItem(direction) {
            const wrappers = DOM.imageInputsWrapper.querySelectorAll('.image-input-group');
            const currentIdx = Array.from(wrappers).indexOf(wrapper);
            if (direction === -1 && currentIdx === 0) return;
            if (direction === 1 && currentIdx === wrappers.length - 1) return;
            const parent = wrapper.parentNode;
            if (direction === -1) {
                parent.insertBefore(wrapper, wrappers[currentIdx - 1]);
            } else {
                parent.insertBefore(wrapper, wrappers[currentIdx + 2] || null);
            }
            updateOrderNumber();
            updateGalleryPreview();
        }

        function setFirst() {
            const parent = wrapper.parentNode;
            parent.insertBefore(wrapper, parent.firstChild);
            updateOrderNumber();
            updateGalleryPreview();
        }

        function setLast() {
            const parent = wrapper.parentNode;
            parent.appendChild(wrapper);
            updateOrderNumber();
            updateGalleryPreview();
        }

        input.addEventListener('input', updatePreview);

        orderInput.addEventListener('change', function() {
            const wrappers = DOM.imageInputsWrapper.querySelectorAll('.image-input-group');
            const items = Array.from(wrappers).map(w => ({
                wrapper: w,
                order: parseInt(w.querySelector('.media-order-input').value) || 0
            }));
            items.sort((a, b) => a.order - b.order);
            const parent = DOM.imageInputsWrapper;
            items.forEach(item => {
                parent.appendChild(item.wrapper);
            });
            updateOrderNumber();
            updateGalleryPreview();
        });

        btnUp.addEventListener('click', () => reorderItem(-1));
        btnDown.addEventListener('click', () => reorderItem(1));
        btnFirst.addEventListener('click', setFirst);
        btnLast.addEventListener('click', setLast);

        fileInput.addEventListener('change', async function(e) {
            const file = this.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file.', 'warning');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
            uploadBtn.textContent = '⏳ Uploading...';
            uploadBtn.disabled = true;
            try {
                const imageUrl = await admin.uploadToImgBB(file);
                input.value = imageUrl;
                input.dispatchEvent(new Event('input'));
                showToast('Image uploaded successfully!', 'success');
            } catch (err) {
                showToast('Upload failed: ' + err.message, 'error');
                updatePreview();
            } finally {
                uploadBtn.textContent = '📤 Upload';
                uploadBtn.disabled = false;
                fileInput.value = '';
            }
        });

        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        removeBtn.addEventListener('click', () => {
            wrapper.remove();
            updateOrderNumber();
            updateGalleryPreview();
            showToast('Media removed. Save product to finalize.', 'info', 2000);
        });

        updatePreview();

        DOM.imageInputsWrapper.appendChild(wrapper);
        updateOrderNumber();
        updateGalleryPreview();
        initMediaSortable();
    }

    function addImageInput(url = '') {
        addMediaInput(url);
    }

    function updateGalleryPreview() {
        const items = getMediaItems();
        items.sort((a, b) => a.order - b.order);
        const urls = items.map(item => item.url);
        DOM.imageGalleryPreview.innerHTML = '';
        if (!urls.length) {
            DOM.imageGalleryPreview.innerHTML = '<div class="preview-placeholder">No media items</div>';
            return;
        }
        urls.forEach(url => {
            const item = document.createElement('div');
            item.style.cssText = 'position:relative; width:80px; height:80px; border-radius:8px; border:1px solid var(--border); overflow:hidden; flex-shrink:0;';
            if (isYouTubeUrl(url)) {
                const thumb = getYouTubeThumbnail(url);
                if (thumb) {
                    item.innerHTML = `
                        <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; inset:0; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:24px; color:#fff;">▶</div>
                    `;
                } else {
                    item.textContent = '❌';
                }
            } else if (isValidUrl(url)) {
                item.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none';this.parentElement.textContent='❌';">`;
            } else {
                item.textContent = '?';
            }
            DOM.imageGalleryPreview.appendChild(item);
        });
    }

    function initMediaSortable() {
        if (mediaSortableInstance) {
            mediaSortableInstance.destroy();
            mediaSortableInstance = null;
        }
        if (window.Sortable && DOM.imageInputsWrapper) {
            mediaSortableInstance = new Sortable(DOM.imageInputsWrapper, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: function() {
                    const orderInputs = DOM.imageInputsWrapper.querySelectorAll('.media-order-input');
                    orderInputs.forEach((inp, idx) => {
                        inp.value = idx + 1;
                    });
                    updateGalleryPreview();
                }
            });
        }
    }

    Object.assign(admin, {
        createSectionBlock, formatDescription, getSectionsData, setSectionsData, reorderSections, initSortableSections,
        getSpecs, setSpecs, addSpecGroup,
        getMediaItems, getMediaUrls, getMediaObjects, setMediaItems, addMediaInput, addImageInput,
        updateGalleryPreview, initMediaSortable
    });

})();