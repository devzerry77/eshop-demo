// ─── CHAINED BD ADDRESS SELECTORS (Division → District → Area) ───
// Renders three modern <select> fields into a container and exposes
// getValues()/setValues() so profile & checkout share the same logic.
import { BD_DIVISIONS } from '../data/bd-address.js';

export function createAddressSelects(container, preset = {}) {
    container.innerHTML = '';

    const fields = [
        { key: 'division', label: 'Division *', placeholder: 'Select Division' },
        { key: 'district', label: 'District *', placeholder: 'Select District' },
        { key: 'area', label: 'Area / Thana', placeholder: 'Select Area' }
    ];

    const selects = {};
    fields.forEach(f => {
        const wrap = document.createElement('div');
        wrap.className = 'field';
        const label = document.createElement('label');
        label.textContent = f.label;
        const sel = document.createElement('select');
        sel.dataset.field = f.key;
        sel.className = 'bd-select';
        if (f.key !== 'area') sel.required = true;
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = f.placeholder;
        ph.selected = true;
        ph.disabled = true;
        sel.appendChild(ph);
        wrap.appendChild(label);
        wrap.appendChild(sel);
        container.appendChild(wrap);
        selects[f.key] = sel;
    });

    const findDivision = (name) => BD_DIVISIONS.find(d => d.name === name);
    const findDistrict = (div, name) => {
        const d = findDivision(div);
        return d ? d.districts.find(ds => ds.name === name) : null;
    };

    function fillDivisions() {
        BD_DIVISIONS.forEach(d => selects.division.appendChild(new Option(d.name, d.name)));
    }

    function fillDistricts(divName) {
        const d = findDivision(divName);
        selects.district.innerHTML = '<option value="">Select District</option>';
        selects.area.innerHTML = '<option value="">Select Area</option>';
        (d ? d.districts : []).forEach(ds => selects.district.appendChild(new Option(ds.name, ds.name)));
    }

    function fillAreas(distName) {
        const ds = findDistrict(selects.division.value, distName);
        selects.area.innerHTML = '<option value="">Select Area</option>';
        (ds ? ds.areas : []).forEach(a => selects.area.appendChild(new Option(a, a)));
    }

    selects.division.addEventListener('change', () => fillDistricts(selects.division.value));
    selects.district.addEventListener('change', () => fillAreas(selects.district.value));

    fillDivisions();

    return {
        getValues() {
            return {
                division: selects.division.value,
                district: selects.district.value,
                area: selects.area.value
            };
        },
        setValues(v = {}) {
            if (v.division && findDivision(v.division)) {
                selects.division.value = v.division;
                fillDistricts(v.division);
                if (v.district && findDistrict(v.division, v.district)) {
                    selects.district.value = v.district;
                    fillAreas(v.district);
                    if (v.area) selects.area.value = v.area;
                }
            }
        }
    };
}