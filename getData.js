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
    // Récupère la valeur du champ texte "Nom d'utilisateur"
    const username = document.getElementById("login_username").value;

    // Récupère la valeur du champ "Mot de passe"
    const password = document.getElementById("login_password").value;

    // Vérifie si le combo login/mot de passe correspond à ce qu'on veut
    if (username === "admin" && password === "1234") {
        // Si les identifiants sont corrects, on cache la section de connexion
        document.getElementById("login_section").style.display = "none";

        // On affiche la section inventaire
        document.getElementById("inventory_section").style.display = "block"; 

        // On cache un éventuel ancien message d’erreur
        document.getElementById("login_error").style.display = "none";

        // On charge les données du fichier Data.csv et on remplit le menu + tableau
        getData();
    } else {  
        // Si les identifiants sont faux, on affiche le message d'erreur
        document.getElementById("login_error").style.display = "block";  // visible
    }
} 

// ===============================
//   FONCTION : logout()
//   (déconnexion utilisateur)
// ===============================
function logout() {
    // On ré-affiche la section de connexion
    document.getElementById("login_section").style.display = "block";

    // On cache la section inventaire
    document.getElementById("inventory_section").style.display = "none"; 

    // On vide le champ "Nom d'utilisateur"
    document.getElementById("login_username").value = "";

    // On vide le champ "Mot de passe"
    document.getElementById("login_password").value = "";

    // On cache le message d'erreur de connexion
    document.getElementById("login_error").style.display = "none";

    // On remet le texte du stock affiché à zéro
    document.getElementById("affichage_stock").textContent = "stock : 0";

    // On récupère le menu déroulant de produits
    const select = document.getElementById("productSelect");

    // Si le menu existe bien (par sécurité)
    if (select) {
        // On remet seulement l’option par défaut
        select.innerHTML = "<option value=\"\">-- Sélectionnez un produit --</option>";
    }

    // On vide le tableau des produits
    document.getElementById("product").innerHTML = "";

    // On réinitialise l’objet global des produits
    produitsParCode = {};
}

// ===============================
//   FONCTION : getData()
//   (lecture du CSV + remplissage tableau + menu déroulant)
// ===============================
function getData() {

    // fetch() : on demande au serveur le fichier Data.csv
    fetch("Data.csv")
        .then(response => {
            // Si la réponse n'est pas "OK" (200), on lance une erreur
            if (!response.ok) {
                throw new Error("Erreur HTTP : " + response.status);
            }
            // On convertit la réponse en texte brut (contenu du CSV)
            return response.text();
        })
        .then(texteCSV => {
            // On réinitialise l'objet global des produits
            produitsParCode = {};

            // On récupère le menu déroulant dans le HTML
            const select = document.getElementById("productSelect");

            // On vide d’abord le menu déroulant
            select.innerHTML = "";

            // On crée l’option par défaut "-- Sélectionnez un produit --"
            const optDefault = document.createElement("option");
            optDefault.value = ""; // valeur vide = aucun produit sélectionné
            optDefault.textContent = "-- Sélectionnez un produit --"; // texte affiché
            select.appendChild(optDefault); // on ajoute cette option au menu

            // On découpe le texte du CSV ligne par ligne
            const lignes = texteCSV.trim().split("\n"); // trim() enlève les espaces au début/fin

            // La première ligne du CSV contient les en-têtes (titres de colonnes)
            const entetes = lignes[0].split(",");

            // On récupère la div où on va afficher le tableau HTML
            const productDiv = document.getElementById("product");

            // On vide ce qu'il y avait avant dans la div
            productDiv.innerHTML = ""; // au cas où on recharge les données

            // On crée un élément <table>
            const table = document.createElement("table"); // tableau HTML

            // On crée un <thead> (partie titre de colonnes)
            const thead = document.createElement("thead"); // en-têtes

            // On crée un <tbody> (contenu des lignes de données)
            const tbody = document.createElement("tbody"); // corps du tableau

            // On crée une ligne pour les en-têtes <tr>
            const trHead = document.createElement("tr");

            // Pour chaque titre d'en-tête dans le CSV
            entetes.forEach(titre => {
                // On crée une cellule d'en-tête <th>
                const th = document.createElement("th");
                // On met le texte du titre dans la cellule
                th.textContent = titre;
                // On ajoute la cellule à la ligne d’en-têtes
                trHead.appendChild(th);
            });

            // --- AJOUT : colonne d'actions (+ / - / saisie) ---
            const thActions = document.createElement("th");
            thActions.textContent = "Actions";
            trHead.appendChild(thActions);
            // --------------------------------------------------

            // On ajoute la ligne d'en-têtes au <thead>
            thead.appendChild(trHead);

            // On ajoute le <thead> à la table
            table.appendChild(thead);

            // On parcourt les lignes des produits à partir de l'indice 1 (on saute la ligne d’en-têtes)
            for (let i = 1; i < lignes.length; i++) {

                // On récupère la ligne brute et on enlève les espaces autour
                const ligneBrute = lignes[i].trim();

                // Si la ligne est vide, on passe à la suivante
                if (ligneBrute === "") continue;

                // On découpe la ligne en colonnes à chaque virgule
                const valeurs = ligneBrute.split(","); // ex : ["123456", "Stylo", "8", "2", "20"]

                // La première colonne est le code-barres
                const codeBarre = valeurs[0];

                // La deuxième colonne est le nom du produit
                const nomProduit = valeurs[1];

                // On crée une nouvelle ligne <tr> pour le tableau
                const tr = document.createElement("tr");

                // On stocke le code-barres dans un attribut data- de la ligne
                tr.dataset.codeBarre = codeBarre;

                // On crée une cellule pour chaque valeur de la ligne
                valeurs.forEach((valeur, index) => {
                    // On crée une cellule <td>
                    const td = document.createElement("td");
                    // On met le texte de la valeur dans la cellule
                    td.textContent = valeur;

                    // Si c'est la colonne de stock (index 2), on lui donne une classe spéciale
                    if (index === 2) {
                        td.classList.add("stockCell"); // permet de la retrouver plus tard
                    }

                    // On ajoute la cellule à la ligne <tr>
                    tr.appendChild(td);
                });

                // --- AJOUT : cellule avec boutons +, -, saisie et OK pour cette ligne ---
                const tdActions = document.createElement("td");

                // Bouton +
                const btnPlus = document.createElement("button");
                btnPlus.textContent = "+";
                btnPlus.onclick = function () {
                    // On sélectionne ce produit dans le menu déroulant
                    document.getElementById("productSelect").value = codeBarre;
                    // On réutilise la fonction existante pour +1
                    stock();
                };

                // Bouton -
                const btnMoins = document.createElement("button");
                btnMoins.textContent = "-";
                btnMoins.onclick = function () {
                    // On sélectionne ce produit dans le menu déroulant
                    document.getElementById("productSelect").value = codeBarre;
                    // On réutilise la fonction existante pour -1
                    retrait();
                };

                // Champ de saisie manuelle pour cette ligne
                const inputLigne = document.createElement("input");
                inputLigne.type = "text";
                inputLigne.size = 5;
                inputLigne.placeholder = "5, +5, -3";

                // Bouton OK pour appliquer la saisie de la ligne
                const btnOk = document.createElement("button");
                btnOk.textContent = "OK";
                btnOk.onclick = function () {
                    // On sélectionne le produit dans le menu déroulant
                    document.getElementById("productSelect").value = codeBarre;
                    // On copie la saisie de la ligne dans le champ global
                    document.getElementById("input_stock").value = inputLigne.value.trim();
                    // On réutilise ta fonction existante definirStock()
                    definirStock();
                    // On vide le champ de la ligne après application
                    inputLigne.value = "";
                };

                // On place les boutons et la saisie dans la cellule
                tdActions.appendChild(btnPlus);
                tdActions.appendChild(btnMoins);
                tdActions.appendChild(inputLigne);
                tdActions.appendChild(btnOk);

                // On ajoute la cellule d'actions à la ligne
                tr.appendChild(tdActions);
                // -----------------------------------------------------------------------

                // On ajoute la ligne complète au <tbody>
                tbody.appendChild(tr);

                // On récupère la cellule de stock de cette ligne
                const stockCell = tr.querySelector(".stockCell");

                // On enregistre ce produit dans l’objet global produitsParCode
                produitsParCode[codeBarre] = {
                    nom: nomProduit,   // nom du produit
                    stockCell: stockCell, // cellule du tableau qui contient le stock
                    row: tr           // la ligne complète <tr>
                };

                // On crée une option pour ce produit dans le menu déroulant
                const opt = document.createElement("option");
                // La valeur de l’option sera le code-barres (clé)
                opt.value = codeBarre;
                // Le texte affiché sera le nom du produit
                opt.textContent = nomProduit;
                // On ajoute cette option au menu déroulant
                select.appendChild(opt);
            }

            // On ajoute finalement le <tbody> au tableau
            table.appendChild(tbody);

            // On place la table dans la div #product
            productDiv.appendChild(table);

            // On définit ce qui se passe quand on change de produit dans le menu déroulant
            select.onchange = function () {
                // On récupère le code-barres sélectionné dans le menu
                const code = this.value;

                // On récupère les infos du produit correspondant dans l’objet global
                const info = produitsParCode[code];

                // On enlève la surbrillance de toutes les lignes
                Object.values(produitsParCode).forEach(p => {
                    p.row.style.backgroundColor = ""; // fond normal
                });

                // Si aucun produit n'est sélectionné ou que l’on ne trouve pas le produit
                if (!code || !info) {
                    // On remet l'affichage du stock à 0
                    document.getElementById("affichage_stock").textContent = "stock : 0";
                    // On sort de la fonction
                    return;
                }

                // On met en surbrillance (bleu clair) la ligne du produit sélectionné
                info.row.style.backgroundColor = "#d0f0ff";

                // On récupère le stock actuel dans la cellule de stock
                const stockActuel = parseInt(info.stockCell.textContent) || 0;

                // On met à jour le paragraphe d'affichage du stock
                document.getElementById("affichage_stock").textContent =
                    "stock : " + stockActuel;
            };
        })
        .catch(error => {
            // Si une erreur se produit (fichier introuvable, etc.), on l'affiche dans la console
            console.error("Erreur lors du chargement du CSV :", error);
        });
}

// ===============================
//   FONCTION : stock()
//   (ajoute +1 au produit sélectionné)
// ===============================
function stock() {
    // On récupère le menu déroulant
    const select = document.getElementById("productSelect");

    // On récupère le code-barres du produit sélectionné
    const code = select.value;

    // On récupère les infos du produit dans l'objet global
    const info = produitsParCode[code];

    // Si aucun produit n'est sélectionné ou introuvable, on affiche un message
    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    // On lit le stock actuel dans la cellule de stock
    let stockActuel = parseInt(info.stockCell.textContent) || 0;

    // On incrémente le stock de 1
    stockActuel++;

    // On met à jour le texte dans la cellule du tableau
    info.stockCell.textContent = stockActuel;

    // On met à jour le texte "stock : X" dans le paragraphe
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;
}

// ===============================
//   FONCTION : retrait()
//   (retire -1 au produit sélectionné)
// ===============================
function retrait() {
    // On récupère le menu déroulant
    const select = document.getElementById("productSelect");

    // On récupère le code-barres sélectionné
    const code = select.value;

    // On récupère les infos du produit
    const info = produitsParCode[code];

    // Si aucun produit n'est sélectionné ou introuvable
    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    // On lit le stock actuel dans la cellule
    let stockActuel = parseInt(info.stockCell.textContent) || 0;

    // On décrémente le stock de 1
    stockActuel--;

    // On empêche le stock de devenir négatif
    if (stockActuel < 0) {
        stockActuel = 0;
    }

    // On met à jour la cellule dans le tableau
    info.stockCell.textContent = stockActuel;

    // On met à jour l'affichage dans le paragraphe
    document.getElementById("affichage_stock").textContent = "stock : " + stockActuel;
}

// ===============================
//   FONCTION : definirStock()
//   (saisie manuelle : 5, +5, -3, etc.)
// ===============================
function definirStock() {
    // On récupère le menu déroulant
    const select = document.getElementById("productSelect");

    // On récupère le code-barres du produit sélectionné
    const code = select.value;

    // On récupère les infos du produit
    const info = produitsParCode[code];

    // Si aucun produit n'est sélectionné, on prévient l'utilisateur
    if (!code || !info) {
        alert("Choisis d'abord un produit dans le menu déroulant.");
        return;
    }

    // On récupère la valeur tapée dans le champ de texte
    const saisie = document.getElementById("input_stock").value.trim();

    // Si rien n'est saisi, on affiche une alerte
    if (saisie === "") {
        alert("Veuillez entrer un nombre (ex : 5, +5, -5).");
        return;
    }

    // On lit le stock actuel
    let stockActuel = parseInt(info.stockCell.textContent) || 0;

    // Variable qui contiendra le nouveau stock calculé
    let nouveau_stock;

    // Si la saisie commence par "+"
    if (saisie[0] === "+") {
        // On lit le nombre après le "+"
        const nombre = parseInt(saisie.substring(1));
        // Si ce n'est pas un nombre, on signale une erreur
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        // Nouveau stock = ancien + nombre
        nouveau_stock = stockActuel + nombre;

    // Si la saisie commence par "-"
    } else if (saisie[0] === "-") {
        // On lit le nombre après le "-"
        const nombre = parseInt(saisie.substring(1));
        // Si ce n'est pas un nombre, on signale une erreur
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        // Nouveau stock = ancien - nombre
        nouveau_stock = stockActuel - nombre; 

    // Sinon, on considère que c'est une valeur absolue (ex : "12")
    } else {
        // On convertit directement en nombre
        const nombre = parseInt(saisie);
        // Si ce n'est pas un nombre, on signale une erreur
        if (isNaN(nombre)) {
            alert("Saisie invalide.");
            return;
        }
        // Nouveau stock = nombre saisi
        nouveau_stock = nombre; 
    }

    // On empêche le stock d’être négatif
    if (nouveau_stock < 0) { // si négatif
        nouveau_stock = 0; // stock minimum = 0
    }

    // On met à jour le stock dans la cellule du tableau
    info.stockCell.textContent = nouveau_stock;

    // On met à jour l’affichage "stock : X"
    document.getElementById("affichage_stock").textContent = "stock : " + nouveau_stock;

    // On vide le champ de saisie global
    document.getElementById("input_stock").value = "";
}
