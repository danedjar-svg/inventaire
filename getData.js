// ===============================
//   VARIABLES GLOBALES
// ===============================

// Objet qui va contenir les infos des produits, rangés par code-barres
// Exemple : { "123456789": { nom: "Stylo", stockCell: <td>, row: <tr> } }
let produitsParCode = {};

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
        select.innerHTML = "<option value=\"\">-- Sélectionnez un produit --</option>";
    }

    document.getElementById("product").innerHTML = "";

    produitsParCode = {};
}

// ===============================
//   FONCTION UTILITAIRE
//   Couleurs + popups min/max
// ===============================
function mettreAJourEtatLigne(codeBarre, info, ancienStock, afficherAlertes) {
    if (!info || !info.row || !info.stockCell) return;

    const tds = info.row.querySelectorAll("td");
    // On suppose : 0 = code, 1 = nom, 2 = stock, 3 = stockMin, 4 = stockMax
    const stock = parseInt(info.stockCell.textContent) || 0;
    const stockMin = parseInt(tds[3]?.textContent) || 0;
    const stockMax = parseInt(tds[4]?.textContent) || 0;

    // Détermination de la couleur
    let bgColor = "";
    if (stock <= stockMin || stock >= stockMax) {
        // Rouge : en dessous du min ou au dessus du max
        bgColor = "#ffb3b3";
    } else {
        // On regarde si on se rapproche (20% des extrémités min/max)
        let proche = false;
        const range = stockMax - stockMin;
        if (range > 0) {
            const marge = Math.ceil(range * 0.2); // 20% de la plage
            if ((stock - stockMin) <= marge || (stockMax - stock) <= marge) {
                proche = true;
            }
        }
        if (proche) {
            // Orange
            bgColor = "#ffe0b3";
        } else {
            // Vert : stock confortable
            bgColor = "#bfffbf";
        }
    }

    info.row.style.backgroundColor = bgColor;

    if (!afficherAlertes) return;

    let messages = [];

    // Alerte pour le stock min
    if (stockMin > 0) {
        const atteintOuSousMin =
            (ancienStock > stockMin && stock <= stockMin) || stock === stockMin;
        if (atteintOuSousMin) {
            messages.push(
                "⚠ Stock MIN atteint ou en dessous pour " +
                info.nom +
                " (" + stock + " / min " + stockMin + ")"
            );
        }
    }

    // Alerte pour le stock max
    if (stockMax > 0) {
        const atteintOuAuDessusMax =
            (ancienStock < stockMax && stock >= stockMax) || stock === stockMax;
        if (atteintOuAuDessusMax) {
            messages.push(
                "⚠ Stock MAX atteint ou au-dessus pour " +
                info.nom +
                " (" + stock + " / max " + stockMax + ")"
            );
        }
    }

    if (messages.length > 0) {
        alert(messages.join("\n"));
    }
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
            // Si on a déjà une sauvegarde locale, on l'utilise à la place
            try {
                const saved = localStorage.getItem("stockCSV");
                if (saved) {
                    texteCSV = saved;
                }
            } catch (e) {
                console.warn("localStorage non disponible ou inaccessible.");
            }

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
            tbody.id = "productBody";

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

                    if (index === 2) {
                        td.classList.add("stockCell");
                    }

                    tr.appendChild(td);
                });

                const tdActions = document.createElement("td");

                const btnPlus = document.createElement("button");
                btnPlus.textContent = "+";
                btnPlus.onclick = function () {
                    document.getElementById("productSelect").value = codeBarre;
                    stock();
                };

                const btnMoins = document.createElement("button");
                btnMoins.textContent = "-";
                btnMoins.onclick = function () {
                    document.getElementById("productSelect").value = codeBarre;
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
                    document.getElementById("input_stock").value = inputLigne.value.trim();
                    definirStock();
                    inputLigne.value = "";
                };

                const btnSuppr = document.createElement("button");
                btnSuppr.textContent = "Supprimer";
                btnSuppr.onclick = function () {
                    if (!confirm("Supprimer ce produit ?")) return;

                    tr.remove();
                    delete produitsParCode[codeBarre];

                    const select = document.getElementById("productSelect");
                    for (let i = 0; i < select.options.length; i++) {
                        if (select.options[i].value === codeBarre) {
                            select.remove(i);
                            break;
                        }
                    }

                    if (select.value === codeBarre) {
                        select.value = "";
                        document.getElementById("affichage_stock").textContent = "stock : 0";
                    }
                };

                tdActions.appendChild(btnPlus);
                tdActions.appendChild(btnMoins);
                tdActions.appendChild(inputLigne);
                tdActions.appendChild(btnOk);
                tdActions.appendChild(btnSuppr);

                tr.appendChild(tdActions);
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

                // Mise à jour couleur initiale (sans popup)
                const stockActuel = parseInt(stockCell.textContent) || 0;
                mettreAJourEtatLigne(codeBarre, produitsParCode[codeBarre], stockActuel, false);
            }

            table.appendChild(tbody);
            productDiv.appendChild(table);

            // Changement de produit dans le menu : on met juste à jour l'affichage du stock
            select.onchange = function () {
                const code = this.value;
                const info = produitsParCode[code];

                if (!code || !info) {
                    document.getElementById("affichage_stock").textContent = "stock : 0";
                    return;
                }

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

    let ancienStock = parseInt(info.stockCell.textContent) || 0;
    let stockActuel = ancienStock + 1;

    info.stockCell.textContent = stockActuel;
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    mettreAJourEtatLigne(code, info, ancienStock, true);
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

    let ancienStock = parseInt(info.stockCell.textContent) || 0;
    let stockActuel = ancienStock - 1;
    if (stockActuel < 0) {
        stockActuel = 0;
    }

    info.stockCell.textContent = stockActuel;
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;

    mettreAJourEtatLigne(code, info, ancienStock, true);
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

    let ancienStock = parseInt(info.stockCell.textContent) || 0;
    let nouveau_stock;

    if (saisie[0] === "+") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = ancienStock + nombre;
    } else if (saisie[0] === "-") {
        const nombre = parseInt(saisie.substring(1));
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = ancienStock - nombre;
    } else {
        const nombre = parseInt(saisie);
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        nouveau_stock = nombre;
    }

    if (nouveau_stock < 0) {
        nouveau_stock = 0;
    }

    info.stockCell.textContent = nouveau_stock;
    document.getElementById("affichage_stock").textContent = "stock : " + nouveau_stock;
    document.getElementById("input_stock").value = "";

    mettreAJourEtatLigne(code, info, ancienStock, true);
}

// ===============================
//   FONCTION : ajouterProduit()
//   (ajout d'une nouvelle ligne + option menu)
// ===============================
function ajouterProduit() {
    const codeBarre = document.getElementById("new_code").value.trim();
    const nomProduit = document.getElementById("new_name").value.trim();
    const stock = parseInt(document.getElementById("new_stock").value) || 0;
    const stockMin = parseInt(document.getElementById("new_min").value) || 0;
    const stockMax = parseInt(document.getElementById("new_max").value) || 0;

    if (!codeBarre || !nomProduit) {
        alert("Code-barres et nom sont obligatoires.");
        return;
    }

    if (produitsParCode[codeBarre]) {
        alert("Un produit avec ce code-barres existe déjà.");
        return;
    }

    const tbody = document.getElementById("productBody");
    if (!tbody) {
        alert("Tableau non trouvé.");
        return;
    }

    const tr = document.createElement("tr");
    tr.dataset.codeBarre = codeBarre;

    const valeurs = [codeBarre, nomProduit, stock, stockMin, stockMax];

    valeurs.forEach((valeur, index) => {
        const td = document.createElement("td");
        td.textContent = valeur;

        if (index === 2) {
            td.classList.add("stockCell");
        }

        tr.appendChild(td);
    });

    const tdActions = document.createElement("td");

    const btnPlus = document.createElement("button");
    btnPlus.textContent = "+";
    btnPlus.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
        stock();
    };

    const btnMoins = document.createElement("button");
    btnMoins.textContent = "-";
    btnMoins.onclick = function () {
        document.getElementById("productSelect").value = codeBarre;
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
        document.getElementById("input_stock").value = inputLigne.value.trim();
        definirStock();
        inputLigne.value = "";
    };

    const btnSuppr = document.createElement("button");
    btnSuppr.textContent = "Supprimer";
    btnSuppr.onclick = function () {
        if (!confirm("Supprimer ce produit ?")) return;

        tr.remove();
        delete produitsParCode[codeBarre];

        const select = document.getElementById("productSelect");
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === codeBarre) {
                select.remove(i);
                break;
            }
        }

        if (select.value === codeBarre) {
            select.value = "";
            document.getElementById("affichage_stock").textContent = "stock : 0";
        }
    };

    tdActions.appendChild(btnPlus);
    tdActions.appendChild(btnMoins);
    tdActions.appendChild(inputLigne);
    tdActions.appendChild(btnOk);
    tdActions.appendChild(btnSuppr);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);

    const stockCell = tr.querySelector(".stockCell");
    produitsParCode[codeBarre] = {
        nom: nomProduit,
        stockCell: stockCell,
        row: tr
    };

    const select = document.getElementById("productSelect");
    const opt = document.createElement("option");
    opt.value = codeBarre;
    opt.textContent = nomProduit;
    select.appendChild(opt);

    // Couleur initiale (sans popup)
    mettreAJourEtatLigne(codeBarre, produitsParCode[codeBarre], stock, false);

    document.getElementById("new_code").value = "";
    document.getElementById("new_name").value = "";
    document.getElementById("new_stock").value = 0;
    document.getElementById("new_min").value = 0;
    document.getElementById("new_max").value = 0;
}

// ===============================
//   OUTILS CSV : construire et sauvegarder
// ===============================
function construireCSVDepuisTable() {
    const table = document.querySelector("#product table");
    if (!table) return null;

    const ths = table.querySelectorAll("thead th");
    const headerValues = [];
    for (let i = 0; i < ths.length - 1; i++) { // on ignore la colonne "Actions"
        headerValues.push(ths[i].textContent);
    }

    const lignes = [];
    lignes.push(headerValues.join(","));

    Object.values(produitsParCode).forEach(p => {
        const tds = p.row.querySelectorAll("td");
        const rowValues = [];
        for (let i = 0; i < tds.length - 1; i++) { // ignore "Actions"
            rowValues.push(tds[i].textContent);
        }
        lignes.push(rowValues.join(","));
    });

    return lignes.join("\n");
}

// Sauvegarde dans le navigateur (localStorage)
function sauvegarderDansNavigateur() {
    const csv = construireCSVDepuisTable();
    if (!csv) {
        alert("Rien à sauvegarder.");
        return;
    }

    try {
        localStorage.setItem("stockCSV", csv);
        alert("Données sauvegardées dans ce navigateur ✅");
    } catch (e) {
        alert("Impossible de sauvegarder (localStorage indisponible).");
    }
}

// Export CSV (téléchargement)
function exporterCSV() {
    const csv = construireCSVDepuisTable();
    if (!csv) {
        alert("Rien à exporter.");
        return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "Data_export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===============================
//   VALIDATION AVEC LA TOUCHE ENTRÉE
// ===============================
// Permet de valider sans cliquer sur les boutons.
document.addEventListener("DOMContentLoaded", () => {
    const onEnter = (el, action) => {
        if (!el) return;
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                action();
            }
        });
    };

    // Connexion (Entrée dans user/mot de passe)
    onEnter(document.getElementById("login_username"), login);
    onEnter(document.getElementById("login_password"), login);

    // Mise à jour du stock (Entrée dans le champ stock)
    onEnter(document.getElementById("input_stock"), definirStock);

    // Ajout produit (Entrée sur un champ -> ajoute)
    const addAction = () => {
        const inv = document.getElementById("inventory_section");
        if (inv && inv.style.display === "none") return; // pas connecté
        ajouterProduit();
    };
    ["new_code", "new_name", "new_stock", "new_min", "new_max"].forEach((id) => {
        onEnter(document.getElementById(id), addAction);
    });
});
