// ===============================
//   VARIABLES GLOBALES
// ===============================

// Objet qui va contenir les infos des produits, rangés par code-barres
// Exemple : { "123456789": { nom: "Stylo", stockCell: <td>, row: <tr> } }
let produitsParCode = {};

// Clé utilisée pour stocker les données dans localStorage
const STORAGE_KEY = "inventaireProduits_v1";

// ===============================
//   FONCTIONS LOCALSTORAGE
// ===============================

/**
 * Lit l'état sauvegardé dans le navigateur (localStorage).
 * Retourne un objet de la forme :
 * {
 *   "123456": { code, nom, stock, stockMin, stockMax, deleted: false },
 *   "789012": { ... }
 * }
 */
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

/**
 * Sauvegarde l'état actuel (toutes les lignes du tableau) dans localStorage.
 * On prend le contenu actuel de produitsParCode et du DOM.
 */
function saveCurrentState() {
    try {
        const saved = loadSavedState();
        const newState = {};

        // On parcourt tous les produits actuellement présents
        Object.keys(produitsParCode).forEach(code => {
            const info = produitsParCode[code];
            const row = info.row;
            const tds = row.querySelectorAll("td");

            // On suppose : 0=code, 1=nom, 2=stock, 3=stockMin, 4=stockMax
            newState[code] = {
                code: tds[0] ? tds[0].textContent : code,
                nom: tds[1] ? tds[1].textContent : "",
                stock: tds[2] ? parseInt(tds[2].textContent) || 0 : 0,
                stockMin: tds[3] ? tds[3].textContent : "0",
                stockMax: tds[4] ? tds[4].textContent : "0",
                deleted: false
            };
        });

        // On garde aussi les produits supprimés (deleted:true) qui existaient déjà
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

/**
 * Applique l'état sauvegardé sur le tableau et le menu déroulant
 * après le chargement du CSV.
 */
function applySavedState(saved, select, tbody) {
    Object.keys(saved).forEach(code => {
        const data = saved[code];

        // Si le produit est marqué supprimé
        if (data.deleted) {
            if (produitsParCode[code]) {
                const row = produitsParCode[code].row;
                row.remove();
                delete produitsParCode[code];

                // Enlever aussi du menu déroulant
                const options = Array.from(select.options);
                options.forEach(opt => {
                    if (opt.value === code) opt.remove();
                });
            }
            return;
        }

        // Produit déjà présent (venant du CSV) -> on met à jour ses valeurs
        if (produitsParCode[code]) {
            const info = produitsParCode[code];
            const row = info.row;
            const tds = row.querySelectorAll("td");

            if (tds[1] && data.nom !== undefined) tds[1].textContent = data.nom;
            if (tds[2] && data.stock !== undefined) {
                tds[2].textContent = data.stock;
                info.stockCell.textContent = data.stock;
            }
            if (tds[3] && data.stockMin !== undefined) tds[3].textContent = data.stockMin;
            if (tds[4] && data.stockMax !== undefined) tds[4].textContent = data.stockMax;
        } else {
            // Produit ajouté dynamiquement dans une ancienne session -> on le recrée

            // Création de la ligne <tr>
            const tr = document.createElement("tr");
            tr.dataset.codeBarre = code;

            // On reconstitue les 5 colonnes principales
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
                if (index === 2) {
                    td.classList.add("stockCell");
                }
                tr.appendChild(td);
            });

            // Ajout de la cellule d'actions ( + / - / saisie / OK / X )
            ajouterCelluleActions(tr, code);

            // Ajout dans le tbody
            tbody.appendChild(tr);

            const stockCell = tr.querySelector(".stockCell");
            produitsParCode[code] = {
                nom: data.nom || "",
                stockCell: stockCell,
                row: tr
            };

            // Ajout dans le menu déroulant
            const opt = document.createElement("option");
            opt.value = code;
            opt.textContent = data.nom || code;
            select.appendChild(opt);
        }
    });
}

// ===============================
//   FONCTION : login()
//   (connexion utilisateur)
// ===============================
function login() {
    const username = document.getElementById("login_username").value;
    const password = document.getElementById("login_password").value;

    if (username === "admin" && password === "1234") {
        document.getElementById("login_section").style.display = "none";
        document.getElementById("inventory_section").style.display = "block";
        document.getElementById("login_error").style.display = "none";

        // Chargement des données
        getData();
    } else {
        document.getElementById("login_error").style.display = "block";
    }
}

// ===============================
//   FONCTION : logout()
//   (déconnexion utilisateur)
// ===============================
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

    // On NE vide PAS le localStorage ici, on garde les données
    produitsParCode = {};
}

// ===============================
//   FONCTION : getData()
//   (lecture du CSV + remplissage tableau + menu déroulant)
// ===============================
function getData() {
    fetch("Data.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error("Erreur HTTP : " + response.status);
            }
            return response.text();
        })
        .then(texteCSV => {
            // On remet à zéro la structure en mémoire
            produitsParCode = {};

            const select = document.getElementById("productSelect");
            select.innerHTML = "";

            // Option par défaut dans le select
            const optDefault = document.createElement("option");
            optDefault.value = "";
            optDefault.textContent = "-- Sélectionnez un produit --";
            select.appendChild(optDefault);

            // Découpage du CSV
            const lignes = texteCSV.trim().split("\n");
            const entetes = lignes[0].split(",");

            const productDiv = document.getElementById("product");
            productDiv.innerHTML = "";

            const table = document.createElement("table");
            const thead = document.createElement("thead");
            const tbody = document.createElement("tbody");

            // En-têtes
            const trHead = document.createElement("tr");
            entetes.forEach(titre => {
                const th = document.createElement("th");
                th.textContent = titre;
                trHead.appendChild(th);
            });

            // Colonne d'actions supplémentaire
            const thActions = document.createElement("th");
            thActions.textContent = "Actions";
            trHead.appendChild(thActions);

            thead.appendChild(trHead);
            table.appendChild(thead);

            // Lignes de données venant du CSV (à partir de l'indice 1)
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

                    if (index === 2) {
                        td.classList.add("stockCell");
                    }

                    tr.appendChild(td);
                });

                // Ajout de la cellule d'actions
                ajouterCelluleActions(tr, codeBarre);

                tbody.appendChild(tr);

                const stockCell = tr.querySelector(".stockCell");
                produitsParCode[codeBarre] = {
                    nom: nomProduit,
                    stockCell: stockCell,
                    row: tr
                };

                // Ajout au menu déroulant
                const opt = document.createElement("option");
                opt.value = codeBarre;
                opt.textContent = nomProduit;
                select.appendChild(opt);
            }

            // On applique les modifications sauvegardées en local (ajouts, suppressions, stocks)
            const saved = loadSavedState();
            applySavedState(saved, select, tbody);

            table.appendChild(tbody);
            productDiv.appendChild(table);

            // Réaction au changement de produit dans le select
            select.onchange = function () {
                const code = this.value;
                const info = produitsParCode[code];

                // On remet le fond normal partout
                Object.values(produitsParCode).forEach(p => {
                    p.row.style.backgroundColor = "";
                });

                // Si aucun produit sélectionné
                if (!code || !info) {
                    document.getElementById("affichage_stock").textContent = "stock : 0";
                    return;
                }

                // Surbrillance de la ligne du produit sélectionné
                info.row.style.backgroundColor = "#d0f0ff";

                // Affichage du stock
                const stockActuel = parseInt(info.stockCell.textContent) || 0;
                document.getElementById("affichage_stock").textContent =
                    "stock : " + stockActuel;
            };
        })
        .catch(error => {
            console.error("Erreur lors du chargement du CSV :", error);
        });
}

// ===============================
//   FONCTION UTILITAIRE :
//   ajoute la cellule Actions à une ligne
// ===============================
function ajouterCelluleActions(tr, codeBarre) {
    const tdActions = document.createElement("td");

    // Bouton +
    const btnPlus = document.createElement("button");
    btnPlus.textContent = "+";
    btnPlus.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        stock();
    };

    // Bouton -
    const btnMoins = document.createElement("button");
    btnMoins.textContent = "-";
    btnMoins.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        retrait();
    };

    // Saisie de stock par ligne
    const inputLigne = document.createElement("input");
    inputLigne.type = "text";
    inputLigne.size = 5;
    inputLigne.placeholder = "5, +5, -3";

    const btnOk = document.createElement("button");
    btnOk.textContent = "OK";
    btnOk.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        document.getElementById("input_stock").value = inputLigne.value.trim();
        definirStock();
        inputLigne.value = "";
    };

    // Bouton suppression (X)
    const btnDel = document.createElement("button");
    btnDel.textContent = "X";
    btnDel.onclick = function () {
        if (!confirm("Supprimer ce produit ?")) return;

        const select = document.getElementById("productSelect");

        // Si ce produit était sélectionné, on réinitialise l'affichage
        if (select.value === codeBarre) {
            select.value = "";
            document.getElementById("affichage_stock").textContent = "stock : 0";
        }

        // Retirer la ligne du DOM
        tr.remove();

        // Retirer de l'objet global
        delete produitsParCode[codeBarre];

        // Retirer du menu déroulant
        const options = Array.from(select.options);
        options.forEach(opt => {
            if (opt.value === codeBarre) opt.remove();
        });

        // Marquer comme supprimé dans localStorage
        const saved = loadSavedState();
        if (!saved[codeBarre]) {
            saved[codeBarre] = { code: codeBarre, deleted: true };
        } else {
            saved[codeBarre].deleted = true;
        }
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
//   FONCTION : addProduct()
//   (ajout d'un nouveau produit dans le tableau)
// ===============================
function addProduct() {
    // On récupère les champs du formulaire d'ajout
    const codeInput = document.getElementById("new_code");
    const nomInput = document.getElementById("new_nom");
    const stockInput = document.getElementById("new_stock");
    const stockMinInput = document.getElementById("new_stock_min");
    const stockMaxInput = document.getElementById("new_stock_max");

    const codeBarre = codeInput.value.trim();
    const nomProduit = nomInput.value.trim();
    const stockInitial = parseInt(stockInput.value) || 0;
    const stockMin = stockMinInput.value.trim() === "" ? "0" : stockMinInput.value.trim();
    const stockMax = stockMaxInput.value.trim() === "" ? "0" : stockMaxInput.value.trim();

    // Vérifications de base
    if (!codeBarre || !nomProduit) {
        alert("Merci de remplir au moins le code-barres et le nom du produit.");
        return;
    }

    if (produitsParCode[codeBarre]) {
        alert("Un produit avec ce code-barres existe déjà.");
        return;
    }

    // On récupère le tableau existant
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

    // Création de la nouvelle ligne
    const tr = document.createElement("tr");
    tr.dataset.codeBarre = codeBarre;

    const valeurs = [codeBarre, nomProduit, stockInitial, stockMin, stockMax];

    valeurs.forEach((valeur, index) => {
        const td = document.createElement("td");
        td.textContent = valeur;

        // Colonne stock
        if (index === 2) {
            td.classList.add("stockCell");
        }

        tr.appendChild(td);
    });

    // Ajout de la cellule Actions
    ajouterCelluleActions(tr, codeBarre);

    // Ajout dans le tableau
    tbody.appendChild(tr);

    // Enregistrement dans l'objet global
    const stockCell = tr.querySelector(".stockCell");
    produitsParCode[codeBarre] = {
        nom: nomProduit,
        stockCell: stockCell,
        row: tr
    };

    // Ajout dans le menu déroulant
    const select = document.getElementById("productSelect");
    const opt = document.createElement("option");
    opt.value = codeBarre;
    opt.textContent = nomProduit;
    select.appendChild(opt);

    // Sauvegarde dans localStorage
    saveCurrentState();

    // Nettoyage des champs du formulaire
    codeInput.value = "";
    nomInput.value = "";
    stockInput.value = "0";
    stockMinInput.value = "0";
    stockMaxInput.value = "0";
}

// ===============================
//   FONCTION : stock()
//   (ajoute +1 au produit sélectionné)
// ===============================
function stock() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    stockActuel++;
    info.stockCell.textContent = stockActuel;

    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    // On sauvegarde la nouvelle valeur
    saveCurrentState();
}

// ===============================
//   FONCTION : retrait()
//   (retire -1 au produit sélectionné)
// ===============================
function retrait() {
    const select = document.getElementById("productSelect");
    const code = select.value;
    const info = produitsParCode[code];

    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    stockActuel--;
    if (stockActuel < 0) {
        stockActuel = 0;
    }

    info.stockCell.textContent = stockActuel;
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    // Sauvegarde
    saveCurrentState();
}

// ===============================
//   FONCTION : definirStock()
//   (saisie manuelle : 5, +5, -3, etc.)
// ===============================
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

    let stockActuel = parseInt(info.stockCell.textContent) || 0;
    let nouveau_stock;

    // Saisie relative +X
    if (saisie[0] === "+") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = stockActuel + nombre;

        // Saisie relative -X
    } else if (saisie[0] === "-") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = stockActuel - nombre;

        // Saisie absolue (ex : "12")
    } else {
        const nombre = parseInt(saisie);
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = nombre;
    }

    // On empêche le stock d'être négatif
    if (nouveau_stock < 0) {
        nouveau_stock = 0;
    }

    // Mise à jour
    info.stockCell.textContent = nouveau_stock;
    document.getElementById("affichage_stock").textContent = "stock : " + nouveau_stock;
    document.getElementById("input_stock").value = "";

    // Sauvegarde
    saveCurrentState();
}
