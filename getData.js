const LOGIN_KEY = "inventaire_logged_in";

let produitsParCode = {};
let selectedCode = "";
let allProductsData = [];

let stockFilterMode = "all";
let emplacementFilterMode = "all";

let currentLetter = "A";
let currentFilteredData = [];

/* ===================== OUTILS ===================== */

function $(id) {
  return document.getElementById(id);
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/R2N/g, "")
    .replace(/\.LC/g, "")
    .replace(/LC/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "");
}

function getInitial(nom) {
  return String(nom || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les accents (É->E, À->A, etc.)
    .charAt(0);
}

function toNum(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/* ===================== MODE ===================== */

function getCurrentMode() {
  const selected = document.querySelector('input[name="work_mode"]:checked');
  return selected ? selected.value : "movement";
}

function updateModeDisplay() {
  const mode = getCurrentMode();
  $("current_mode_text").textContent =
    mode === "inventory"
      ? "Mode actuel : Inventaire"
      : "Mode actuel : Entrée / Sortie";
}

function setMode(mode) {
  const radio = document.querySelector(`input[name="work_mode"][value="${mode}"]`);

  if (radio) {
    radio.checked = true;
    updateModeDisplay();
  }

  document.querySelectorAll(".menu-item[data-mode]").forEach(item => {
    item.classList.remove("active");
    if (item.dataset.mode === mode) {
      item.classList.add("active");
    }
  });
}

/* ===================== SELECTION ===================== */

function clearSelectionHighlight() {
  Object.values(produitsParCode).forEach(p => {
    if (p.row) p.row.classList.remove("status-selected");
  });
}

function setSelected(code) {
  selectedCode = normalizeCode(code || "");
  clearSelectionHighlight();

  const info = produitsParCode[selectedCode];

  if (!selectedCode || !info) return;

  info.row.classList.add("status-selected");
}

/* ===================== LOGIN ===================== */

async function login() {
  const email = $("login_email").value.trim();
  const password = $("login_password").value.trim();

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    $("login_error").style.display = "block";
    console.error(error);
    return;
  }

  localStorage.setItem(LOGIN_KEY, "1");

  $("login_section").style.display = "none";
  $("inventory_section").style.display = "block";
  $("login_error").style.display = "none";

  await getData();
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(LOGIN_KEY);

  $("login_section").style.display = "block";
  $("inventory_section").style.display = "none";
}

/* ===================== DONNEES SUPABASE ===================== */

async function getData() {
  const { data, error } = await supabaseClient
    .from("produit")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    console.error(error);
    showToast("Erreur Supabase", "error");
    return;
  }

  allProductsData = data || [];
  applyFilters();
}


/* ===================== DASHBOARD ===================== */

function updateDashboard() {
  const data = allProductsData;

  // Nombre de types de produits
  const nbProduits = data.length;

  // Somme exacte de tous les stocks
  const stockTotal = data.reduce((s, p) => s + toNum(p.stock, 0), 0);

  // Critiques = stock <= 0
  const critiques = data.filter(p => toNum(p.stock, 0) <= 0).length;

  // Par emplacement = nombre de produits avec cet emplacement (exclut "" et "-- Choisir --")
  const bungalow = data.filter(p => p.emplacement === "Bungalow").length;
  const retrofit = data.filter(p => p.emplacement === "Container Retrofit").length;
  const sav      = data.filter(p => p.emplacement === "Container SAV").length;

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  set("kpi_produits",    nbProduits);
  set("kpi_stock_total", stockTotal);
  set("kpi_critiques",   critiques);
  set("kpi_bungalow",    bungalow);
  set("kpi_retrofit",    retrofit);
  set("kpi_sav",         sav);
}

function applyFilters() {
  let filteredData = [...allProductsData];

  if (stockFilterMode === "hide0") {
    filteredData = filteredData.filter(item => toNum(item.stock, 0) !== 0);
  }

  if (stockFilterMode === "only0") {
    filteredData = filteredData.filter(item => toNum(item.stock, 0) === 0);
  }

  if (emplacementFilterMode !== "all") {
    filteredData = filteredData.filter(item =>
      (item.emplacement || "") === emplacementFilterMode
    );
  }

  const searchInput = document.querySelector(".search-bar");
  const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (searchValue) {
    const normalizeText = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const searchNorm = normalizeText(searchValue);
    filteredData = filteredData.filter(item => {
      const code = normalizeCode(item.code_barre).toLowerCase();
      const nom = normalizeText(item.nom);
      return code.includes(searchNorm) || nom.includes(searchNorm);
    });
  }

  currentFilteredData = filteredData;
  currentLetter = searchValue ? "all" : "A";
  updateDashboard();
  renderTable(currentFilteredData);
}

/* ===================== TABLEAU ===================== */

function updateRowStatus(tr) {
  const tds = tr.querySelectorAll("td");
  if (tds.length < 6) return;

  const stock = toNum(tds[2].textContent, 0);
  const stockMin = toNum(tds[3].textContent, 0);
  const stockMax = toNum(tds[4].textContent, 0);

  tr.classList.remove("status-good", "status-warning", "status-danger");

  if (stock < 0 || stock < stockMin || stock > stockMax) {
    tr.classList.add("status-danger");
  } else if (stock === stockMin + 1 || stock === stockMax - 1) {
    tr.classList.add("status-warning");
  } else {
    tr.classList.add("status-good");
  }
}

function ajouterCelluleActions(tr, codeBarre) {
  const td = document.createElement("td");

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.onclick = async event => {
    event.stopPropagation();
    setSelected(codeBarre);
    await stock(codeBarre);
  };

  const btnMoins = document.createElement("button");
  btnMoins.textContent = "-";
  btnMoins.onclick = async event => {
    event.stopPropagation();
    setSelected(codeBarre);
    await retrait(codeBarre);
  };

  td.appendChild(btnPlus);
  td.appendChild(btnMoins);
  tr.appendChild(td);
}

function renderTable(data) {
  produitsParCode = {};
  $("product").innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const trHead = document.createElement("tr");

  const thCode = document.createElement("th");
  thCode.textContent = "Référence";
  trHead.appendChild(thCode);

  const thNom = document.createElement("th");
  thNom.textContent = "Nom";
  trHead.appendChild(thNom);

  const thStock = document.createElement("th");
  const stockSelect = document.createElement("select");
  stockSelect.innerHTML = `
    <option value="all">Stock : Tous</option>
    <option value="hide0">Masquer stock 0</option>
    <option value="only0">Seulement stock 0</option>
  `;
  stockSelect.value = stockFilterMode;
  stockSelect.onchange = function () {
    stockFilterMode = this.value;
    applyFilters();
  };
  thStock.appendChild(stockSelect);
  trHead.appendChild(thStock);

  const thMin = document.createElement("th");
  thMin.textContent = "Min";
  trHead.appendChild(thMin);

  const thMax = document.createElement("th");
  thMax.textContent = "Max";
  trHead.appendChild(thMax);

  const thEmplacement = document.createElement("th");
  const emplacementFilter = document.createElement("select");
  emplacementFilter.innerHTML = `
    <option value="all">Emplacement : Tous</option>
    <option value="Bungalow">Bungalow</option>
    <option value="Container Retrofit">Container Retrofit</option>
    <option value="Container SAV">Container SAV</option>
  `;
  emplacementFilter.value = emplacementFilterMode;
  emplacementFilter.onchange = function () {
    emplacementFilterMode = this.value;
    applyFilters();
  };
  thEmplacement.appendChild(emplacementFilter);
  trHead.appendChild(thEmplacement);

  const thActions = document.createElement("th");
  thActions.textContent = "Actions";
  trHead.appendChild(thActions);

  thead.appendChild(trHead);
  table.appendChild(thead);

  // Déterminer quelles lettres sont présentes dans les données
  const availableLetters = new Set(
    data.map(item => getInitial(item.nom)).filter(c => c >= "A" && c <= "Z")
  );

  // Filtrer par lettre sélectionnée
  const visibleData = currentLetter === "all"
    ? data
    : data.filter(item => getInitial(item.nom) === currentLetter);

  data.forEach(item => {
    const code = normalizeCode(item.code_barre);
    const tr = document.createElement("tr");
    const nomInitial = getInitial(item.nom);
    const matchLetter = currentLetter === "all" || nomInitial === currentLetter;
    tr.style.display = matchLetter ? "" : "none";
    tr.dataset.letterMatch = matchLetter ? "1" : "0";

    const tdCode = document.createElement("td");
    tdCode.textContent = code;
    tr.appendChild(tdCode);

    const tdNom = document.createElement("td");
    tdNom.textContent = item.nom || "";
    tr.appendChild(tdNom);

    const tdStock = document.createElement("td");
    const stockSpan = document.createElement("span");
    stockSpan.textContent = item.stock ?? 0;
    tdStock.appendChild(stockSpan);
    tdStock.classList.add("stockCell");
    tr.appendChild(tdStock);

    const tdMin = document.createElement("td");
    tdMin.textContent = item.stock_min ?? 1;
    tr.appendChild(tdMin);

    const tdMax = document.createElement("td");
    tdMax.textContent = item.stock_max ?? 7;
    tr.appendChild(tdMax);

    const tdEmplacement = document.createElement("td");
    const emplacementSelect = document.createElement("select");
    emplacementSelect.innerHTML = `
      <option value="">-- Choisir --</option>
      <option value="Bungalow">Bungalow</option>
      <option value="Container Retrofit">Container Retrofit</option>
      <option value="Container SAV">Container SAV</option>
    `;
    emplacementSelect.value = item.emplacement || "";

    emplacementSelect.onchange = async function (event) {
      event.stopPropagation();

      const { error } = await supabaseClient
        .from("produit")
        .update({ emplacement: this.value })
        .eq("code_barre", code);

      if (error) {
        console.error(error);
        showToast("Erreur changement emplacement.", "error");
        return;
      }

      await getData();
    };

    tdEmplacement.appendChild(emplacementSelect);
    tr.appendChild(tdEmplacement);

    ajouterCelluleActions(tr, code);

    tr.onclick = function (event) {
      if (
        event.target.tagName === "BUTTON" ||
        event.target.tagName === "SELECT"
      ) return;

      setSelected(code);
    };

    tr.ondblclick = function (event) {
      if (
        event.target.tagName === "BUTTON" ||
        event.target.tagName === "SELECT"
      ) return;

      setSelected(code);
      openModalProduitsOnStock(code);
    };

    tbody.appendChild(tr);

    produitsParCode[code] = {
      nom: item.nom || "",
      row: tr,
      stockCell: stockSpan
    };

    updateRowStatus(tr);
  });

  table.appendChild(tbody);

  // ===== BARRE DE LETTRES =====
  const letterBar = document.createElement("div");
  letterBar.className = "letter-bar";

  // Bouton "Tous"
  const btnAll = document.createElement("button");
  btnAll.textContent = "Tous";
  btnAll.className = "letter-btn" + (currentLetter === "all" ? " active" : "");
  btnAll.onclick = () => {
    currentLetter = "all";
    renderTable(currentFilteredData);
  };
  letterBar.appendChild(btnAll);

  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const btn = document.createElement("button");
    btn.textContent = letter;
    btn.className = "letter-btn" + (letter === currentLetter ? " active" : "") + (!availableLetters.has(letter) ? " disabled" : "");
    btn.disabled = !availableLetters.has(letter);
    btn.onclick = () => {
      currentLetter = letter;
      renderTable(currentFilteredData);
    };
    letterBar.appendChild(btn);
  }

  // Afficher la barre AU DESSUS du tableau
  $("product").appendChild(letterBar);
  $("product").appendChild(table);

  // Info compteur
  const info = document.createElement("div");
  info.className = "pagination-info";
  info.textContent = currentLetter === "all"
    ? `${data.length} produit(s)`
    : `${visibleData.length} produit(s) — Lettre "${currentLetter}"`;
  $("product").appendChild(info);
}

/* ===================== STOCK ===================== */

async function updateStock(code, nouveauStock) {
  const { error } = await supabaseClient
    .from("produit")
    .update({ stock: nouveauStock })
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    showToast("Erreur mise à jour du stock.", "error");
    return false;
  }

  await getData();

  // Alerte stock bas : 0 ou négatif
  if (nouveauStock <= 0) {
    const info = produitsParCode[code];
    const nom = info ? info.nom : code;
    showStockAlert(nom, nouveauStock);
  }

  return true;
}

async function stock(code = selectedCode) {
  code = normalizeCode(code);
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) + 1;
  await updateStock(code, nouveau);
}

async function retrait(code = selectedCode) {
  code = normalizeCode(code);
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) - 1;
  await updateStock(code, nouveau);
}

async function definirStock(code = selectedCode, valeur = null) {
  code = normalizeCode(code);

  if (!code) return;

  const quantite = valeur !== null ? toNum(valeur, NaN) : NaN;

  if (!Number.isFinite(quantite)) {
    showToast("Valeur invalide.", "warning");
    return;
  }

  await updateStock(code, quantite);
}

/* ===================== SCANNER ===================== */

async function handleBarcodeScan(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  const input = $("barcode_input");
  const result = $("barcode_result");

  const code = normalizeCode(input.value);
  input.value = code;

  if (!code) return;

  const produit = produitsParCode[code];

  if (!produit) {
    result.textContent = "Produit non trouvé : " + code;
    showToast("Produit non trouvé : " + code, "warning");
    input.value = "";
    input.focus();
    return;
  }

  setSelected(code);

  if (getCurrentMode() === "inventory") {
    const valeur = prompt(
      "Inventaire\n\nProduit : " + produit.nom +
      "\nStock actuel : " + toNum(produit.stockCell.textContent, 0) +
      "\n\nQuantité réelle trouvée :"
    );

    if (valeur === null) {
      input.value = "";
      input.focus();
      return;
    }

    const quantite = toNum(valeur, NaN);

    if (!Number.isFinite(quantite)) {
      showToast("Valeur invalide.", "warning");
      input.value = "";
      input.focus();
      return;
    }

    const ok = await updateStock(code, quantite);

    if (ok) {
      result.textContent = "Inventaire effectué : " + produit.nom;
    }

    input.value = "";
    input.focus();
    return;
  }

  const choix = prompt(
    "Entrée / Sortie\n\nProduit : " + produit.nom +
    "\nStock actuel : " + toNum(produit.stockCell.textContent, 0) +
    "\n\n1 = Entrée +1" +
    "\n2 = Sortie -1"
  );

  if (choix === "1") {
    const nouveau = toNum(produit.stockCell.textContent, 0) + 1;
    const ok = await updateStock(code, nouveau);

    if (ok) {
      result.textContent = "Entrée +1 : " + produit.nom;
    }
  } else if (choix === "2") {
    const nouveau = toNum(produit.stockCell.textContent, 0) - 1;
    const ok = await updateStock(code, nouveau);

    if (ok) {
      result.textContent = "Sortie -1 : " + produit.nom;
    }
  } else {
    result.textContent = "Action annulée : " + produit.nom;
  }

  input.value = "";
  input.focus();
}

/* ===================== MODAL PRODUITS ===================== */

function openModalProduits() {
  const modal = $("modal_produits");
  if (!modal) { console.error("modal_produits introuvable"); return; }

  modal.style.display = "flex";

  // Remettre sur l'onglet Ajouter par défaut
  const firstTab = modal.querySelector(".modal-tab");
  if (firstTab) switchModalTab("add", firstTab);

  const editSelect = $("m_edit_select");
  const deleteSelect = $("m_delete_select");
  const stockSelect = $("m_stock_select");
  if (!editSelect || !deleteSelect || !stockSelect) return;

  editSelect.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';
  deleteSelect.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';
  stockSelect.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  // Peupler depuis allProductsData (toujours disponible) ou produitsParCode
  const source = allProductsData.length > 0
    ? allProductsData.map(p => ({ code: normalizeCode(p.code_barre), nom: p.nom || "" }))
    : Object.entries(produitsParCode).map(([code, info]) => ({ code, nom: info.nom }));

  source.forEach(({ code, nom }) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = nom + " (" + code + ")";
    editSelect.appendChild(opt);
    deleteSelect.appendChild(opt.cloneNode(true));
    stockSelect.appendChild(opt.cloneNode(true));
  });

  $("m_edit_fields").style.display = "none";
  $("m_delete_info").style.display = "none";
  $("m_stock_fields").style.display = "none";
}

function closeModalProduits(event) {
  if (event && event.target !== $("modal_produits")) return;
  $("modal_produits").style.display = "none";
}

function switchModalTab(tab, btn) {
  ["add", "edit", "delete", "stock"].forEach(t => {
    $("modal_tab_" + t).style.display = "none";
  });

  document.querySelectorAll(".modal-tab").forEach(b => {
    b.classList.remove("active");
  });

  $("modal_tab_" + tab).style.display = "block";
  btn.classList.add("active");
}

async function modalAddProduct() {
  const code = normalizeCode($("m_new_code").value);
  const nom = $("m_new_nom").value.trim();
  const emplacement = $("m_new_emplacement").value;

  if (!code || !nom || !emplacement) {
    showToast("Référence, nom et emplacement obligatoires.", "warning");
    return;
  }

  const { error } = await supabaseClient.from("produit").insert([{
    code_barre: code,
    nom: nom,
    stock: toNum($("m_new_stock").value),
    stock_min: toNum($("m_new_stock_min").value),
    stock_max: toNum($("m_new_stock_max").value),
    emplacement: emplacement
  }]);

  if (error) {
    console.error(error);
    showToast("Erreur ajout produit.", "error");
    return;
  }

  $("m_new_code").value = "";
  $("m_new_nom").value = "";
  $("m_new_stock").value = "0";
  $("m_new_stock_min").value = "1";
  $("m_new_stock_max").value = "7";
  $("m_new_emplacement").value = "";

  await getData();
  $("modal_produits").style.display = "none";
}

function fillEditForm() {
  const code = $("m_edit_select").value;
  const fields = $("m_edit_fields");

  const item = allProductsData.find(p => normalizeCode(p.code_barre) === code);

  if (!item) {
    fields.style.display = "none";
    return;
  }

  $("m_edit_nom").value = item.nom || "";
  $("m_edit_stock_min").value = item.stock_min ?? 1;
  $("m_edit_stock_max").value = item.stock_max ?? 7;
  $("m_edit_emplacement").value = item.emplacement || "";

  fields.style.display = "block";
}

async function modalEditProduct() {
  const code = $("m_edit_select").value;

  if (!code) return;

  const { error } = await supabaseClient.from("produit").update({
    nom: $("m_edit_nom").value.trim(),
    stock_min: toNum($("m_edit_stock_min").value),
    stock_max: toNum($("m_edit_stock_max").value),
    emplacement: $("m_edit_emplacement").value
  }).eq("code_barre", code);

  if (error) {
    console.error(error);
    showToast("Erreur modification.", "error");
    return;
  }

  await getData();
  $("modal_produits").style.display = "none";
}

function fillDeleteInfo() {
  const code = $("m_delete_select").value;
  const info = produitsParCode[code];
  const deleteInfo = $("m_delete_info");

  if (!info) {
    deleteInfo.style.display = "none";
    return;
  }

  $("m_delete_label").textContent = info.nom + " — " + code;
  deleteInfo.style.display = "block";
}

async function modalDeleteProduct() {
  const code = $("m_delete_select").value;

  if (!code) return;

  if (!confirm("Supprimer ce produit définitivement ?")) return;

  const { error } = await supabaseClient
    .from("produit")
    .delete()
    .eq("code_barre", code);

  if (error) {
    console.error(error);
    showToast("Erreur suppression.", "error");
    return;
  }

  await getData();
  $("modal_produits").style.display = "none";
}

function modalFillStock() {
  const code = $("m_stock_select").value;
  const info = produitsParCode[code];
  const fields = $("m_stock_fields");

  if (!info) {
    fields.style.display = "none";
    return;
  }

  $("m_affichage_stock").textContent = toNum(info.stockCell.textContent, 0);
  $("m_input_stock").value = "";
  fields.style.display = "block";
}

async function modalStockPlus() {
  const code = $("m_stock_select").value;
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) + 1;
  const ok = await updateStock(code, nouveau);

  if (ok) {
    $("m_affichage_stock").textContent = nouveau;
  }
}

async function modalStockMoins() {
  const code = $("m_stock_select").value;
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) - 1;
  const ok = await updateStock(code, nouveau);

  if (ok) {
    $("m_affichage_stock").textContent = nouveau;
  }
}

async function modalDefinirStock() {
  const code = $("m_stock_select").value;
  const valeur = toNum($("m_input_stock").value, NaN);

  if (!code) return;

  if (!Number.isFinite(valeur)) {
    showToast("Valeur invalide.", "warning");
    return;
  }

  const ok = await updateStock(code, valeur);

  if (ok) {
    $("m_input_stock").value = "";
    $("m_affichage_stock").textContent = valeur;
  }
}

/* ===================== MODAL PRODUITS — OUVERTURE DIRECTE STOCK ===================== */

function openModalProduitsOnStock(code) {
  // Ouvre le modal normalement (peuple les selects)
  openModalProduits();

  // Bascule sur l'onglet "Ajuster stock"
  const stockTabBtn = document.querySelector(".modal-tab[onclick*=\"'stock'\"]");
  if (stockTabBtn) {
    switchModalTab("stock", stockTabBtn);
  }

  // Pré-sélectionne le produit dans le select
  const stockSelect = document.getElementById("m_stock_select");
  if (stockSelect) {
    stockSelect.value = code;
    // Déclenche l'affichage des champs
    modalFillStock();
  }
}

/* ===================== MODAL KPI ===================== */

function openKpiModal(filtre) {
  const modal = document.getElementById("modal_kpi");
  const title = document.getElementById("modal_kpi_title");
  const list  = document.getElementById("modal_kpi_list");

  if (!modal || !title || !list) return;

  // Titre
  const titres = {
    "all":               "Tous les produits",
    "critiques":         "Produits critiques (stock ≤ 0)",
    "Bungalow":          "Bungalow",
    "Container Retrofit":"Container Retrofit",
    "Container SAV":     "Container SAV"
  };
  title.textContent = titres[filtre] || filtre;

  // Filtrage
  let data = [...allProductsData];
  if (filtre === "critiques") {
    data = data.filter(p => toNum(p.stock, 0) <= 0);
  } else if (filtre !== "all") {
    data = data.filter(p => (p.emplacement || "") === filtre);
  }

  // Construction de la liste
  list.innerHTML = "";

  if (data.length === 0) {
    list.innerHTML = "<p style='color:var(--text-muted); text-align:center; padding:24px;'>Aucun produit.</p>";
  } else {
    data.forEach(p => {
      const stock = toNum(p.stock, 0);
      const stockMin = toNum(p.stock_min, 1);
      const stockMax = toNum(p.stock_max, 7);

      let statusClass = "status-good";
      if (stock < 0 || stock < stockMin || stock > stockMax) statusClass = "status-danger";
      else if (stock === stockMin + 1 || stock === stockMax - 1) statusClass = "status-warning";

      const row = document.createElement("div");
      row.className = "kpi-modal-row " + statusClass;
      row.innerHTML = `
        <span class="kpi-modal-nom">${p.nom || "—"}</span>
        <span class="kpi-modal-code">${normalizeCode(p.code_barre)}</span>
        <span class="kpi-modal-emplacement">${p.emplacement || "—"}</span>
        <span class="kpi-modal-stock">Stock : <strong>${stock}</strong></span>
      `;
      list.appendChild(row);
    });
  }

  modal.style.display = "flex";
}

function closeKpiModal(event) {
  if (event && event.target !== document.getElementById("modal_kpi")) return;
  document.getElementById("modal_kpi").style.display = "none";
}

/* ===================== MODAL PARAMÈTRES ===================== */

function openSettingsModal() {
  const modal = document.getElementById("modal_settings");
  if (!modal) return;

  const newPass = document.getElementById("settings_new_password");
  const confirmPass = document.getElementById("settings_confirm_password");
  const msg = document.getElementById("settings_password_msg");
  if (newPass) newPass.value = "";
  if (confirmPass) confirmPass.value = "";
  if (msg) { msg.textContent = ""; msg.style.color = ""; }

  modal.style.display = "flex";
}

function closeSettingsModal(event) {
  if (event && event.target !== document.getElementById("modal_settings")) return;
  document.getElementById("modal_settings").style.display = "none";
}

async function changePassword() {
  const newPass = document.getElementById("settings_new_password").value;
  const confirmPass = document.getElementById("settings_confirm_password").value;
  const msg = document.getElementById("settings_password_msg");

  msg.className = "settings-msg";
  msg.textContent = "";

  if (!newPass || newPass.length < 6) {
    msg.classList.add("settings-msg-error");
    msg.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
    return;
  }

  if (newPass !== confirmPass) {
    msg.classList.add("settings-msg-error");
    msg.textContent = "Les mots de passe ne correspondent pas.";
    return;
  }

  msg.textContent = "Mise à jour en cours...";

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    if (error) {
      msg.className = "settings-msg settings-msg-error";
      msg.textContent = "Erreur : " + error.message;
      showToast("Erreur lors du changement de mot de passe", "error");
      return;
    }

    msg.className = "settings-msg settings-msg-success";
    msg.textContent = "Mot de passe mis à jour avec succès !";
    showToast("Mot de passe modifié", "success");

    document.getElementById("settings_new_password").value = "";
    document.getElementById("settings_confirm_password").value = "";
  } catch (err) {
    msg.className = "settings-msg settings-msg-error";
    msg.textContent = "Erreur inattendue : " + err.message;
    showToast("Erreur lors du changement de mot de passe", "error");
  }
}

/* ===================== TOASTS ===================== */

function showToast(message, type = "info") {
  const id = "toast-" + Date.now();
  const icons = { error: "❌", warning: "⚠️", info: "ℹ️", success: "✅" };

  const toast = document.createElement("div");
  toast.id = id;
  toast.className = `app-toast app-toast--${type}`;
  toast.innerHTML = `
    <div class="app-toast-icon">${icons[type] || "ℹ️"}</div>
    <div class="app-toast-message">${message}</div>
    <button class="app-toast-close" onclick="document.getElementById('${id}').remove()">✕</button>
  `;

  const offset = document.querySelectorAll(".app-toast").length * 70;
  toast.style.bottom = (28 + offset) + "px";

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("app-toast--visible"));

  setTimeout(() => {
    toast.classList.remove("app-toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 5000);
}

/* ===================== ALERTE STOCK ===================== */

function showStockAlert(nom, stock) {
  // Supprimer une alerte existante si déjà présente
  const existing = document.getElementById("stock-alert-toast");
  if (existing) existing.remove();

  const isNeg = stock < 0;

  const toast = document.createElement("div");
  toast.id = "stock-alert-toast";
  toast.innerHTML = `
    <div class="stock-toast-icon">${isNeg ? "📉" : "📦"}</div>
    <div class="stock-toast-body">
      <div class="stock-toast-title">${isNeg ? "Stock négatif !" : "Stock épuisé !"}</div>
      <div class="stock-toast-nom">${nom}</div>
      <div class="stock-toast-val">Stock actuel : <strong>${stock}</strong></div>
    </div>
    <button class="stock-toast-close" onclick="document.getElementById('stock-alert-toast').remove()">✕</button>
  `;
  toast.className = isNeg ? "stock-toast stock-toast--neg" : "stock-toast stock-toast--zero";

  document.body.appendChild(toast);

  // Entrée animée
  requestAnimationFrame(() => toast.classList.add("stock-toast--visible"));

  // Disparaît automatiquement après 6s
  setTimeout(() => {
    toast.classList.remove("stock-toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 6000);
}

/* ===================== EVENTS ===================== */

document.addEventListener("input", function (event) {
  if (
    event.target.id === "barcode_input" ||
    event.target.id === "m_new_code"
  ) {
    const cleaned = normalizeCode(event.target.value);

    if (event.target.value !== cleaned) {
      event.target.value = cleaned;
    }
  }

  if (event.target.classList.contains("search-bar")) {
    applyFilters();
  }
});

document.addEventListener("DOMContentLoaded", async function () {
  document
    .querySelectorAll('input[name="work_mode"]')
    .forEach(radio => {
      radio.addEventListener("change", function() {
        updateModeDisplay();
        setMode(this.value);
      });
    });

  updateModeDisplay();

  document.querySelectorAll(".menu-item[data-mode]").forEach(item => {
    item.addEventListener("click", () => setMode(item.dataset.mode));
  });

  const btnProduits = document.querySelector(".menu-item[data-action='produits']");
  if (btnProduits) {
    btnProduits.addEventListener("click", () => openModalProduits());
  }

  const { data } = await supabaseClient.auth.getSession();

  if (
    data.session ||
    localStorage.getItem(LOGIN_KEY) === "1"
  ) {
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    await getData();
  }

  const barcodeInput = $("barcode_input");
  if (barcodeInput) {
    barcodeInput.focus();
  }

  supabaseClient
    .channel("realtime-produit")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "produit"
      },
      async () => {
        await getData();
      }
    )
    .subscribe();
})