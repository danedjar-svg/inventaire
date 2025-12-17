// Marge (en unités) pour considérer qu'on "s'approche" du min/max
// Exemple : stockMin=10 -> orange si stock <= 12
//          stockMax=50 -> orange si stock >= 48
const APPROCHE_MARGE = 2;

// ===============================
//   COULEURS / STATUT DE LIGNE
// ===============================

/**
 * Met à jour la couleur (classe CSS) d'une ligne en fonction :
 * - rouge  : stock < 0, ou stock < stockMin, ou stock > stockMax
 * - orange : on s'approche du min/max (marge définie par APPROCHE_MARGE)
 * - vert   : stock OK
 */
function updateRowStatus(tr) {
    if (!tr) return;

    const tds = tr.querySelectorAll("td");
    // Colonnes : 0=code, 1=nom, 2=stock, 3=stockMin, 4=stockMax
    if (!tds || tds.length < 5) return;

    const stock = parseFloat((tds[2]?.textContent || "").replace(",", ".")) || 0;

    // Si min/max sont vides, on garde NaN pour éviter de déclencher des alertes à tort
    const rawMin = (tds[3]?.textContent || "").trim();
    const rawMax = (tds[4]?.textContent || "").trim();
    const stockMin = rawMin === "" ? NaN : (parseFloat(rawMin.replace(",", ".")));
    const stockMax = rawMax === "" ? NaN : (parseFloat(rawMax.replace(",", ".")));

    tr.classList.remove("status-good", "status-warning", "status-danger");

    const hasMin = Number.isFinite(stockMin);
    const hasMax = Number.isFinite(stockMax);

    // Rouge = hors bornes / critique
    const isDanger =
        stock < 0 ||
        (hasMin && stock < stockMin) ||
        (hasMax && stock > stockMax);

    // Orange = on s'approche d'une borne (sans l'avoir dépassée)
    const isWarning = !isDanger && (
        (hasMin && stock <= (stockMin + APPROCHE_MARGE)) ||
        (hasMax && stock >= (stockMax - APPROCHE_MARGE))
    );

    tr.classList.add(isDanger ? "status-danger" : (isWarning ? "status-warning" : "status-good"));
}

function updateAllRowsStatus() {
    Object.values(produitsParCode).forEach((p) => {
        updateRowStatus(p.tr);
    });
}

// ===============================
//   LOGIN (simple pour démo)
// ===============================

function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    // Identifiants en dur pour l'exemple
    if (username === "admin" && password === "admin") {
        document.getElementById("login_section").style.display = "none";
        document.getElementById("inventory_section").style.display = "block";
        document.getElementById("login_error").style.display = "none";
    } else {
        document.getElementById("login_error").style.display = "block";
    }
}

// ===============================
//   STOCK / CSV
// ===============================

let produitsParCode = {}; // { code_barre: { code, nom, stock, min, max, tr } }
let selectedCode = null;

// Charge le CSV (Data.csv) et remplit le tableau
function loadCSV() {
    fetch("Data.csv")
        .then((response) => response.text())
        .then((csvText) => {
            parseCSV(csvText);
        })
        .catch((err) => {
            console.error("Erreur chargement CSV:", err);
            alert("Impossible de charger Data.csv (vérifie que le fichier est au même endroit).");
        });
}

function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    if (lines.length <= 1) {
        alert("CSV vide ou invalide.");
        return;
    }

    // En-tête : code_barre,nom_produit,stock,stock_min,stock_max
    const headers = lines[0].split(",").map((h) => h.trim());
    const tbody = document.querySelector("#stock_table tbody");
    tbody.innerHTML = "";

    produitsParCode = {};
    selectedCode = null;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 5) continue;

        const code = (cols[0] || "").trim();
        const nom = (cols[1] || "").trim();
        const stock = parseFloat((cols[2] || "0").trim().replace(",", ".")) || 0;
        const stockMin = parseFloat((cols[3] || "0").trim().replace(",", ".")) || 0;
        const stockMax = parseFloat((cols[4] || "0").trim().replace(",", ".")) || 0;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${code}</td>
            <td>${nom}</td>
            <td>${stock}</td>
            <td>${stockMin}</td>
            <td>${stockMax}</td>
        `;

        tr.addEventListener("click", () => {
            selectRow(code);
        });

        tbody.appendChild(tr);

        produitsParCode[code] = {
            code,
            nom,
            stock,
            stockMin,
            stockMax,
            tr
        };
    }

    updateAllRowsStatus();
}

// Met la classe "status-selected" sur la ligne cliquée
function selectRow(code) {
    // Enlève la sélection de l'ancienne ligne
    if (selectedCode && produitsParCode[selectedCode]) {
        produitsParCode[selectedCode].tr.classList.remove("status-selected");
    }

    selectedCode = code;

    if (produitsParCode[selectedCode]) {
        produitsParCode[selectedCode].tr.classList.add("status-selected");
    }
}

// Récupère le code barre saisi (scan_code)
function getScannedCode() {
    return document.getElementById("scan_code").value.trim();
}

function getQtyChange() {
    const v = parseFloat(document.getElementById("qty_change").value);
    return Number.isFinite(v) ? v : 0;
}

// + Ajouter du stock
function incrementerStock() {
    const code = getScannedCode();
    const qty = getQtyChange();

    if (!code || !produitsParCode[code]) {
        alert("Produit introuvable (charge le CSV et vérifie le code barre).");
        return;
    }

    const p = produitsParCode[code];
    p.stock = (parseFloat(p.stock) || 0) + qty;

    // Met à jour la cellule stock
    p.tr.querySelectorAll("td")[2].textContent = p.stock;

    // Met à jour statut couleur
    updateRowStatus(p.tr);

    // Optionnel : auto-sélectionner la ligne modifiée
    selectRow(code);
}

// - Retirer du stock (peut devenir négatif)
function decrementerStock() {
    const code = getScannedCode();
    const qty = getQtyChange();

    if (!code || !produitsParCode[code]) {
        alert("Produit introuvable (charge le CSV et vérifie le code barre).");
        return;
    }

    const p = produitsParCode[code];
    p.stock = (parseFloat(p.stock) || 0) - qty;

    // Met à jour la cellule stock
    p.tr.querySelectorAll("td")[2].textContent = p.stock;

    // Met à jour statut couleur
    updateRowStatus(p.tr);

    // Optionnel : auto-sélectionner la ligne modifiée
    selectRow(code);
}

// Sauvegarde l'état du tableau en CSV (téléchargement côté navigateur)
function saveCSV() {
    const headers = ["code_barre", "nom_produit", "stock", "stock_min", "stock_max"];
    let csv = headers.join(",") + "\n";

    Object.values(produitsParCode).forEach((p) => {
        const row = [
            p.code,
            p.nom,
            p.stock,
            p.stockMin,
            p.stockMax
        ];
        csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Data.csv";
    a.click();

    URL.revokeObjectURL(url);
}

// Ajoute un produit au tableau et à la structure JS
function ajouterProduit() {
    const code = document.getElementById("new_code").value.trim();
    const nom = document.getElementById("new_name").value.trim();
    const stock = parseFloat(document.getElementById("new_stock").value) || 0;
    const stockMin = parseFloat(document.getElementById("new_min").value) || 0;
    const stockMax = parseFloat(document.getElementById("new_max").value) || 0;

    if (!code || !nom) {
        alert("Code barre et nom produit obligatoires.");
        return;
    }

    if (produitsParCode[code]) {
        alert("Ce code barre existe déjà.");
        return;
    }

    const tbody = document.querySelector("#stock_table tbody");
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>${code}</td>
        <td>${nom}</td>
        <td>${stock}</td>
        <td>${stockMin}</td>
        <td>${stockMax}</td>
    `;

    tr.addEventListener("click", () => {
        selectRow(code);
    });

    tbody.appendChild(tr);

    produitsParCode[code] = {
        code,
        nom,
        stock,
        stockMin,
        stockMax,
        tr
    };

    updateRowStatus(tr);
    selectRow(code);

    // reset champs
    document.getElementById("new_code").value = "";
    document.getElementById("new_name").value = "";
    document.getElementById("new_stock").value = "0";
    document.getElementById("new_min").value = "0";
    document.getElementById("new_max").value = "0";
}
