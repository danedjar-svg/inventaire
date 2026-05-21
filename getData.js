const LOGIN_KEY = "inventaire_logged_in";

let produitsParCode = {};
let selectedCode = "";
let allProductsData = [];

function openModalProduits() {
  const modal = document.getElementById("modal_produits");
  modal.style.display = "flex";

  const editSelect = document.getElementById("m_edit_select");
  const deleteSelect = document.getElementById("m_delete_select");
  editSelect.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';
  deleteSelect.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  Object.entries(produitsParCode).forEach(([code, info]) => {
    const opt1 = document.createElement("option");
    opt1.value = code;
    opt1.textContent = info.nom + " (" + code + ")";
    editSelect.appendChild(opt1);
    const opt2 = opt1.cloneNode(true);
    deleteSelect.appendChild(opt2);
  });

  document.getElementById("m_edit_fields").style.display = "none";
  document.getElementById("m_delete_info").style.display = "none";
}

function closeModalProduits(event) {
  if (event && event.target !== document.getElementById("modal_produits")) return;
  document.getElementById("modal_produits").style.display = "none";
}

function switchModalTab(tab, btn) {
  ["add", "edit", "delete"].forEach(t => {
    document.getElementById("modal_tab_" + t).style.display = "none";
  });
  document.querySelectorAll(".modal-tab").forEach(b => b.classList.remove("active"));
  document.getElementById("modal_tab_" + tab).style.display = "block";
  btn.classList.add("active");
}

function fillEditForm() {
  const code = document.getElementById("m_edit_select").value;
  const info = produitsParCode[code];
  const fields = document.getElementById("m_edit_fields");
  if (!info) { fields.style.display = "none"; return; }
  const item = allProductsData.find(p => normalizeCode(p.code_barre) === code);
  if (!item) return;
  document.getElementById("m_edit_nom").value = item.nom || "";
  document.getElementById("m_edit_stock_min").value = item.stock_min ?? 1;
  document.getElementById("m_edit_stock_max").value = item.stock_max ?? 7;
  document.getElementById("m_edit_emplacement").value = item.emplacement || "";
  fields.style.display = "block";
}

function fillDeleteInfo() {
  const code = document.getElementById("m_delete_select").value;
  const info = produitsParCode[code];
  const deleteInfo = document.getElementById("m_delete_info");
  if (!info) { deleteInfo.style.display = "none"; return; }
  document.getElementById("m_delete_label").textContent = info.nom + " — " + code;
  deleteInfo.style.display = "block";
}

async function modalAddProduct() {
  const code = normalizeCode(document.getElementById("m_new_code").value);
  const nom = document.getElementById("m_new_nom").value.trim();
  const emplacement = document.getElementById("m_new_emplacement").value;
  if (!code || !nom || !emplacement) { alert("Code barre, nom et emplacement obligatoires."); return; }
  const { error } = await supabaseClient.from("produit").insert([{
    code_barre: code, nom, stock: toNum(document.getElementById("m_new_stock").value),
    stock_min: toNum(document.getElementById("m_new_stock_min").value),
    stock_max: toNum(document.getElementById("m_new_stock_max").value), emplacement
  }]);
  if (error) { console.error(error); alert("Erreur ajout produit."); return; }
  document.getElementById("m_new_code").value = "";
  document.getElementById("m_new_nom").value = "";
  document.getElementById("m_new_stock").value = "0";
  document.getElementById("m_new_stock_min").value = "1";
  document.getElementById("m_new_stock_max").value = "7";
  document.getElementById("m_new_emplacement").value = "";
  await getData();
  document.getElementById("modal_produits").style.display = "none";
}

async function modalEditProduct() {
  const code = document.getElementById("m_edit_select").value;
  if (!code) return;
  const { error } = await supabaseClient.from("produit").update({
    nom: document.getElementById("m_edit_nom").value.trim(),
    stock_min: toNum(document.getElementById("m_edit_stock_min").value),
    stock_max: toNum(document.getElementById("m_edit_stock_max").value),
    emplacement: document.getElementById("m_edit_emplacement").value
  }).eq("code_barre", code);
  if (error) { console.error(error); alert("Erreur modification."); return; }
  await getData();
  document.getElementById("modal_produits").style.display = "none";
}

async function modalDeleteProduct() {
  const code = document.getElementById("m_delete_select").value;
  if (!code) return;
  if (!confirm("Supprimer ce produit définitivement ?")) return;
  await supabaseClient.from("produit").delete().eq("code_barre", code);
  await getData();
  document.getElementById("modal_produits").style.display = "none";
}

let stockFilterMode = "all";
let emplacementFilterMode = "all";

function normalizeCode(code) {
  return String(code)
    .trim()
    .toUpperCase()
    .replace(/R2N/g, "")
    .replace(/\.LC/g, "")
    .replace(/LC/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "");
}

function $(id) {
  return document.getElementById(id);
}

function toNum(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

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

function clearSelectionHighlight() {
  Object.values(produitsParCode).forEach(p => {
    if (p.row) p.row.classList.remove("status-selected");
  });
}

function setSelected(code) {
  selectedCode = normalizeCode(code || "");
  clearSelectionHighlight();

  const info = produitsParCode[selectedCode];

  if (!selectedCode || !info) {
    $("affichage_stock").textContent = "stock : 0";
    return;
  }

  info.row.classList.add("status-selected");
  $("affichage_stock").textContent =
    "stock : " + toNum(info.stockCell.textContent, 0);
}

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

  getData();
}

async function logout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem(LOGIN_KEY);

  $("login_section").style.display = "block";
  $("inventory_section").style.display = "none";
}

function rebuildDropdown() {
  const select = $("productSelect");
  select.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';

  Object.entries(produitsParCode).forEach(([code, info]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = info.nom;
    select.appendChild(option);
  });

  select.onchange = function () {
    setSelected(this.value);
  };
}

function ajouterCelluleActions(tr, codeBarre) {
  const td = document.createElement("td");

  const btnPlus = document.createElement("button");
  btnPlus.textContent = "+";
  btnPlus.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    stock();
  };

  const btnMoins = document.createElement("button");
  btnMoins.textContent = "-";
  btnMoins.onclick = () => {
    $("productSelect").value = codeBarre;
    setSelected(codeBarre);
    retrait();
  };

  td.appendChild(btnPlus);
  td.appendChild(btnMoins);
  tr.appendChild(td);
}

async function getData() {
  const { data, error } = await supabaseClient
    .from("produit")
    .select("*")
    .order("nom", { ascending: true });

  if (error) {
    console.error(error);
    alert("Erreur Supabase");
    return;
  }

  allProductsData = data || [];
  applyFilters();
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

  renderTable(filteredData);
}

function renderTable(data) {
  produitsParCode = {};
  $("product").innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const trHead = document.createElement("tr");

  const thCode = document.createElement("th");
  thCode.textContent = "Code barre";
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

  data.forEach(item => {
    const code = normalizeCode(item.code_barre);
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    tdCode.textContent = code;
    tr.appendChild(tdCode);

    const tdNom = document.createElement("td");
    tdNom.textContent = item.nom || "";
    tr.appendChild(tdNom);

    const tdStock = document.createElement("td");
    tdStock.textContent = item.stock ?? 0;
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

    emplacementSelect.onchange = async function () {
      const { error } = await supabaseClient
        .from("produit")
        .update({ emplacement: this.value })
        .eq("code_barre", code);

      if (error) {
        console.error(error);
        alert("Erreur changement emplacement.");
        return;
      }

      getData();
    };

    tdEmplacement.appendChild(emplacementSelect);
    tr.appendChild(tdEmplacement);

    ajouterCelluleActions(tr, code);

    tr.onclick = function (event) {
      if (
        event.target.tagName === "BUTTON" ||
        event.target.tagName === "SELECT"
      ) return;

      $("productSelect").value = code;
      setSelected(code);
    };

    tbody.appendChild(tr);

    produitsParCode[code] = {
      nom: item.nom || "",
      row: tr,
      stockCell: tdStock
    };

    updateRowStatus(tr);
  });

  table.appendChild(tbody);
  $("product").appendChild(table);

  rebuildDropdown();
}

async function stock() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) + 1;

  await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  getData();
}

async function retrait() {
  const code = normalizeCode($("productSelect").value);
  const info = produitsParCode[code];

  if (!info) return;

  const nouveau = toNum(info.stockCell.textContent, 0) - 1;

  await supabaseClient
    .from("produit")
    .update({ stock: nouveau })
    .eq("code_barre", code);

  getData();
}

async function definirStock() {
  const code = normalizeCode($("productSelect").value);
  const valeur = toNum($("input_stock").value);

  await supabaseClient
    .from("produit")
    .update({ stock: valeur })
    .eq("code_barre", code);

  $("input_stock").value = "";
  getData();
}

async function inventoryUpdate(code) {
  const produit = produitsParCode[code];

  if (!produit) return;

  const valeur = prompt(
    "Inventaire : " + produit.nom +
    "\n\nQuantité réelle trouvée :"
  );

  if (valeur === null) return;

  const quantite = toNum(valeur, NaN);

  if (!Number.isFinite(quantite)) {
    alert("Valeur invalide");
    return;
  }

  await supabaseClient
    .from("produit")
    .update({ stock: quantite })
    .eq("code_barre", code);

  getData();
}

async function addProduct() {
  const code = normalizeCode($("new_code").value);
  const nom = $("new_nom").value.trim();
  const emplacement = $("new_emplacement").value;

  if (!code || !nom || !emplacement) {
    alert("Code barre, nom et emplacement obligatoires.");
    return;
  }

  const { error } = await supabaseClient
    .from("produit")
    .insert([{
      code_barre: code,
      nom: nom,
      stock: toNum($("new_stock").value),
      stock_min: toNum($("new_stock_min").value),
      stock_max: toNum($("new_stock_max").value),
      emplacement: emplacement
    }]);

  if (error) {
    console.error(error);
    alert("Erreur ajout produit.");
    return;
  }

  $("new_code").value = "";
  $("new_nom").value = "";
  $("new_stock").value = "0";
  $("new_stock_min").value = "1";
  $("new_stock_max").value = "7";
  $("new_emplacement").value = "";

  getData();
}

async function deleteProduct() {
  const code = normalizeCode($("delete_code").value);

  await supabaseClient
    .from("produit")
    .delete()
    .eq("code_barre", code);

  $("delete_code").value = "";
  getData();
}

async function handleBarcodeScan(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  let code = normalizeCode($("barcode_input").value);
  $("barcode_input").value = code;

  const produit = produitsParCode[code];

  if (!produit) {
    $("barcode_result").textContent =
      "Produit non trouvé : " + code;

    $("new_code").value = code;
    $("delete_code").value = code;

    return;
  }

  $("productSelect").value = code;
  setSelected(code);

  if (getCurrentMode() === "inventory") {
    await inventoryUpdate(code);

    $("barcode_result").textContent =
      "Inventaire effectué : " + produit.nom;

    $("barcode_input").value = "";
    return;
  }

  const choix = prompt(
    "Produit : " + produit.nom +
    "\n\n1 = Ajouter +1" +
    "\n2 = Retirer -1"
  );

  if (choix === "1") {
    await stock();
    $("barcode_result").textContent =
      "Ajout +1 : " + produit.nom;
  } else if (choix === "2") {
    await retrait();
    $("barcode_result").textContent =
      "Retrait -1 : " + produit.nom;
  }

  $("barcode_input").value = "";
}

document.addEventListener("input", function (event) {
  if (
    event.target.id === "barcode_input" ||
    event.target.id === "new_code" ||
    event.target.id === "delete_code"
  ) {
    const cleaned = normalizeCode(event.target.value);

    if (event.target.value !== cleaned) {
      event.target.value = cleaned;
    }
  }
});

function setMode(mode) {
  const radio = document.querySelector(`input[name="work_mode"][value="${mode}"]`);
  if (radio) {
    radio.checked = true;
    updateModeDisplay();
  }

  document.querySelectorAll(".menu-item[data-mode]").forEach(item => {
    item.classList.remove("active");
    if (item.dataset.mode === mode) item.classList.add("active");
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  document
    .querySelectorAll('input[name="work_mode"]')
    .forEach(radio => {
      radio.addEventListener("change", updateModeDisplay);
    });

  updateModeDisplay();

  document.querySelectorAll(".menu-item[data-mode]").forEach(item => {
    item.addEventListener("click", () => setMode(item.dataset.mode));
  });

  const { data } = await supabaseClient.auth.getSession();

  if (
    data.session ||
    localStorage.getItem(LOGIN_KEY) === "1"
  ) {
    $("login_section").style.display = "none";
    $("inventory_section").style.display = "block";
    getData();
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
      () => {
        getData();
      }
    )
    .subscribe();
});