// ===============================
//   VARIABLES GLOBALES
// ===============================

let produitsParCode = {}; // { "code": { nom, stockCell, row } }
const STORAGE_KEY = "inventaireProduits_v1";

// marge pour l'orange (approche des seuils)
const APPROCHE_MARGE = 5;

// ===============================
//   COULEURS / STATUT DE LIGNE
// ===============================

function updateRowStatus(tr) {
    if (!tr) return;

    const tds = tr.querySelectorAll("td");
    // 0=code, 1=nom, 2=stock, 3=stockMin, 4=stockMax
    if (!tds || tds.length < 5) return;

    const stock = parseFloat((tds[2]?.textContent || "0").replace(",", ".")) || 0;

    const minTxt = (tds[3]?.textContent || "").trim();
    const maxTxt = (tds[4]?.textContent || "").trim();

    // Si min/max manquent, on ne déclenche pas d'alertes basées dessus
    const stockMin = minTxt === "" ? NaN : parseFloat(minTxt.replace(",", "."));
    const stockMax = maxTxt === "" ? NaN : parseFloat(maxTxt.replace(",", "."));

    const hasMin = Number.isFinite(stockMin);
    const hasMax = Number.isFinite(stockMax);

    tr.classList.remove("status-good", "status-warning", "status-danger");

    // ROUGE = critique : négatif OU sous min OU au-dessus max
    const isDanger =
        stock < 0 ||
        (hasMin && stock < stockMin) ||
        (hasMax && stock > stockMax);

    // ORANGE = proche d'un seuil (sans être déjà rouge)
    const isWarning = !isDanger && (
        (hasMin && stock <= stockMin + APPROCHE_MARGE) ||
        (hasMax && stock >= stockMax - APPROCHE_MARGE)
    );

    tr.classList.add(isDanger ? "status-danger" : (isWarning ? "status-warning" : "status-good"));
}

function updateAllRowsStatus() {
    Object.values(produitsParCode).forEach(p => updateRowStatus(p.row));
}

// ===============================
//   FONCTIONS LOCALSTORAGE
// ===============================

function loadSavedState() {
    try {
        const txt = localStorage.getItem(STORAGE_KEY);
        if (!txt) return {};
        return JSON.parse(txt);
    } catch (e) {
        console.error("Erreur lecture localStorage :", e);
        return {};
    }
}

function saveCurrentState() {
    try {
        const saved = loadSavedState();
        const newState = {};

        Object.keys(produitsParCode).forEach(code => {
            const info = produitsParCode[code];
            const row = info.row;
            const tds = row.querySelectorAll("td");

            newState[code] = {
                code: tds[0] ? tds[0].textContent : code,
                nom: tds[1] ? tds[1].textContent : "",
                stock: tds[2] ? parseFloat(tds[2].textContent) || 0 : 0,
                stockMin: tds[3] ? tds[3].textContent : "0",
                stockMax: tds[4] ? tds[4].textContent : "0",
                deleted: false
            };
        });

        Object.keys(saved).forEach(code => {
            if (saved[code].deleted && !newState[code]) {
                newState[code] = { ...saved[code], deleted: true };
            }
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
        console.error("Erreur écriture localStorage :", e);
    }
}

function applySavedState(saved, select, tbody) {
    Object.keys(saved).forEach(code => {
        const data = saved[code];

        if (data.deleted) {
            if (produitsParCode[code]) {
                const row = produitsParCode[code].row;
                row.remove();
                delete produitsParCode[code];

                const options = Array.from(select.options);
                options.forEach(opt => {
                    if (opt.value === code) opt.remove();
                });
            }
            return;
        }

        if (produitsParCode[code]) {
            const info = produitsParCode[code];
            const row = info.row;
            const tds = row.querySelectorAll("td");

            if (tds[1] && data.nom !== undefined) tds[1].textContent = data.nom;
            if (tds[2] && data.stock !== undefined) tds[2].textContent = data.stock;
            if (tds[3] && data.stockMin !== undefined) tds[3].textContent = data.stockMin;
            if (tds[4] && data.stockMax !== undefined) tds[4].textContent = data.stockMax;

            updateRowStatus(row);
        } else {
            const tr = document.createElement("tr");
            tr.dataset.codeBarre = code;

            const valeurs = [
                data.code || code,
                data.nom || "",
                data.stock !== undefined ? data.stock : 0,
                data.stockMin !== undefined ? data.stockMin : "0",
                data.stockMax !== undefined ? data.stockMax : "0"
            ];

            valeurs.forEach((valeur, index) => {
                const td = document.createElement("td");
                td.textContent = valeur;
                if (index === 2) td.classList.add("stockCell");
                tr.appendChild(td);
            });

            ajouterCelluleActions(tr, code);
            tbody.appendChild(tr);

            const stockCell = tr.querySelector(".stockCell");
            produitsParCode[code] = {
                nom: data.nom || "",
                stockCell: stockCell,
                row: tr
            };

            const opt = document.createElement("option");
            opt.value = code;
            opt.textContent = data.nom || code;
            select.appendChild(opt);

            updateRowStatus(tr);
        }
    });
}

// ===============================
//   LOGIN / LOGOUT
// ===============================

function login() {
    const username = document.getElementById("login_username").value;
    const password = document.getElementById("login_password").value;

    if (username === "admin" && password === "1234") {
        document.getElementById("login_section").style.display = "none";
        document.getElementById("inventory_section").style.display = "block";
        document.getElementById("login_error").style.display = "none";
        getData();
    } else {
        document.getElementById("login_error").style.display = "block";
    }
}

function logout() {
    document.getElementById("login_section").style.display = "block";
    document.getElementById("inventory_section").style.display = "none";

    document.getElementById("login_username").value = "";
    document.getElementById("login_password").value = "";
    document.getElementById("login_error").style.display = "none";

    document.getElementById("affichage_stock").textContent = "stock : 0";

    const select = document.getElementById("productSelect");
    if (select) {
        select.innerHTML = '<option value="">-- Sélectionnez un produit --</option>';
    }

    document.getElementById("product").innerHTML = "";
    produitsParCode = {};
}

// ===============================
//   getData() : lecture CSV
// ===============================

function clearSelectionHighlight() {
    Object.values(produitsParCode).forEach(p => p.row.classList.remove("status-selected"));
}

function getData() {
    fetch("Data.csv")
        .then(response => {
            if (!response.ok) throw new Error("Erreur HTTP : " + response.status);
            return response.text();
        })
        .then(texteCSV => {
            produitsParCode = {};

            const select = document.getElementById("productSelect");
            select.innerHTML = "";

            const optDefault = document.createElement("option");
            optDefault.value = "";
            optDefault.textContent = "-- Sélectionnez un produit --";
            select.appendChild(optDefault);

            const lignes = texteCSV.trim().split("\n");
            const entetes = lignes[0].split(",");

            const productDiv = document.getElementById("product");
            productDiv.innerHTML = "";

            const table = document.createElement("table");
            const thead = document.createElement("thead");
            const tbody = document.createElement("tbody");

            const trHead = document.createElement("tr");
            entetes.forEach(titre => {
                const th = document.createElement("th");
                th.textContent = titre;
                trHead.appendChild(th);
            });

            const thActions = document.createElement("th");
            thActions.textContent = "Actions";
            trHead.appendChild(thActions);

            thead.appendChild(trHead);
            table.appendChild(thead);

            for (let i = 1; i < lignes.length; i++) {
                const ligneBrute = lignes[i].trim();
                if (ligneBrute === "") continue;

                const valeurs = ligneBrute.split(",");
                const codeBarre = valeurs[0];
                const nomProduit = valeurs[1];

                const tr = document.createElement("tr");
                tr.dataset.codeBarre = codeBarre;

                valeurs.forEach((valeur, index) => {
                    const td = document.createElement("td");
                    td.textContent = valeur;
                    if (index === 2) td.classList.add("stockCell");
                    tr.appendChild(td);
                });

                ajouterCelluleActions(tr, codeBarre);

                tbody.appendChild(tr);

                const stockCell = tr.querySelector(".stockCell");
                produitsParCode[codeBarre] = {
                    nom: nomProduit,
                    stockCell: stockCell,
                    row: tr
                };

                const opt = document.createElement("option");
                opt.value = codeBarre;
                opt.textContent = nomProduit;
                select.appendChild(opt);

                updateRowStatus(tr);
            }

            const saved = loadSavedState();
            applySavedState(saved, select, tbody);

            table.appendChild(tbody);
            productDiv.appendChild(table);

            // Selection dans le select => sélection + affichage stock
            select.onchange = function () {
                const code = this.value;
                const info = produitsParCode[code];

                clearSelectionHighlight();

                if (!code || !info) {
                    document.getElementById("affichage_stock").textContent = "stock : 0";
                    return;
                }

                info.row.classList.add("status-selected");

                const stockActuel = parseFloat(info.stockCell.textContent) || 0;
                document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;
            };

            // applique un dernier passage (sécurité)
            updateAllRowsStatus();
        })
        .catch(error => {
            console.error("Erreur lors du chargement du CSV :", error);
            alert("Impossible de charger Data.csv (vérifie que le fichier est au même endroit).");
        });
}

// ===============================
//   Cellule Actions par ligne
// ===============================

function ajouterCelluleActions(tr, codeBarre) {
    const tdActions = document.createElement("td");

    const btnPlus = document.createElement("button");
    btnPlus.textContent = "+";
    btnPlus.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        document.getElementById("productSelect").dispatchEvent(new Event("change"));
        stock();
    };

    const btnMoins = document.createElement("button");
    btnMoins.textContent = "-";
    btnMoins.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        document.getElementById("productSelect").dispatchEvent(new Event("change"));
        retrait();
    };

    const inputLigne = document.createElement("input");
    inputLigne.type = "text";
    inputLigne.size = 5;
    inputLigne.placeholder = "5, +5, -3";

    const btnOk = document.createElement("button");
    btnOk.textContent = "OK";
    btnOk.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        document.getElementById("productSelect").dispatchEvent(new Event("change"));
        document.getElementById("input_stock").value = inputLigne.value.trim();
        definirStock();
        inputLigne.value = "";
    };

    const btnDel = document.createElement("button");
    btnDel.textContent = "X";
    btnDel.onclick = function () {
        if (!confirm("Supprimer ce produit ?")) return;

        const select = document.getElementById("productSelect");

        if (select.value === codeBarre) {
            select.value = "";
            clearSelectionHighlight();
            document.getElementById("affichage_stock").textContent = "stock : 0";
        }

        tr.remove();
        delete produitsParCode[codeBarre];

        const options = Array.from(select.options);
        options.forEach(opt => {
            if (opt.value === codeBarre) opt.remove();
        });

        const saved = loadSavedState();
        if (!saved[codeBarre]) saved[codeBarre] = { code: codeBarre, deleted: true };
        saved[codeBarre].deleted = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    };

    tdActions.appendChild(btnPlus);
    tdActions.appendChild(btnMoins);
    tdActions.appendChild(inputLigne);
    tdActions.appendChild(btnOk);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdActions);
}

// ===============================
//   Ajout produit
// ===============================

function addProduct() {
    const codeInput = document.getElementById("new_code");
    const nomInput = document.getElementById("new_nom");
    const stockInput = document.getElementById("new_stock");
    const stockMinInput = document.getElementById("new_stock_min");
    const stockMaxInput = document.getElementById("new_stock_max");

    const codeBarre = codeInput.value.trim();
    const nomProduit = nomInput.value.trim();
    const stockInitial = parseFloat(stockInput.value) || 0;
    const stockMin = stockMinInput.value.trim() === "" ? "0" : stockMinInput.value.trim();
    const stockMax = stockMaxInput.value.trim() === "" ? "0" : stockMaxInput.value.trim();

    if (!codeBarre || !nomProduit) {
        alert("Merci de remplir au moins le code-barres et le nom du produit.");
        return;
    }

    if (produitsParCode[codeBarre]) {
        alert("Un produit avec ce code-barres existe déjà.");
        return;
    }

    const table = document.querySelector("#product table");
    if (!table) {
        alert("Tableau non trouvé.");
        return;
    }
    const tbody = table.querySelector("tbody");
    if (!tbody) {
        alert("Corps du tableau non trouvé.");
        return;
    }

    const tr = document.createElement("tr");
    tr.dataset.codeBarre = codeBarre;

    const valeurs = [codeBarre, nomProduit, stockInitial, stockMin, stockMax];

    valeurs.forEach((valeur, index) => {
        const td = document.createElement("td");
        td.textContent = valeur;
        if (index === 2) td.classList.add("stockCell");
        tr.appendChild(td);
    });

    ajouterCelluleActions(tr, codeBarre);
    tbody.appendChild(tr);

    const stockCell = tr.querySelector(".stockCell");
    produitsParCode[codeBarre] = { nom: nomProduit, stockCell: stockCell, row: tr };

    const select = document.getElementById("productSelect");
    const opt = document.createElement("option");
    opt.value = codeBarre;
    opt.textContent = nomProduit;
    select.appendChild(opt);

    updateRowStatus(tr);
    saveCurrentState();

    codeInput.value = "";
    nomInput.value = "";
    stockInput.value = "0";
    stockMinInput.value = "0";
    stockMaxInput.value = "0";
}

// ===============================
//   Stock / Retrait / Définir
// ===============================

function stock() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseFloat(info.stockCell.textContent) || 0;
    stockActuel++;
    info.stockCell.textContent = stockActuel;

    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    updateRowStatus(info.row);
    saveCurrentState();
}

function retrait() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseFloat(info.stockCell.textContent) || 0;
    stockActuel--; // on autorise le négatif (pour le ROUGE)
    info.stockCell.textContent = stockActuel;

    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    updateRowStatus(info.row);
    saveCurrentState();
}

function definirStock() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    const saisie = document.getElementById("input_stock").value.trim();
    if (saisie === "") {
        alert("Veuillez entrer un nombre (ex : 5, +5, -5).");
        return;
    }

    let stockActuel = parseFloat(info.stockCell.textContent) || 0;
    let nouveau_stock;

    if (saisie[0] === "+") {
        const nombre = parseFloat(saisie.substring(1).replace(",", "."));
        if (!Number.isFinite(nombre)) return alert("Saisie invalide.");
        nouveau_stock = stockActuel + nombre;
    } else if (saisie[0] === "-") {
        const nombre = parseFloat(saisie.substring(1).replace(",", "."));
        if (!Number.isFinite(nombre)) return alert("Saisie invalide.");
        nouveau_stock = stockActuel - nombre;
    } else {
        const nombre = parseFloat(saisie.replace(",", "."));
        if (!Number.isFinite(nombre)) return alert("Saisie invalide.");
        nouveau_stock = nombre;
    }

    info.stockCell.textContent = nouveau_stock;
    document.getElementById("affichage_stock").textContent = "stock : " + nouveau_stock;
    document.getElementById("input_stock").value = "";

    updateRowStatus(info.row);
    saveCurrentState();
}
