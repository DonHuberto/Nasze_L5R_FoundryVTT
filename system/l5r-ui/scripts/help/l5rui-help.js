//fonctions et class déportées
import { openES } from "./openES.js";
import { openDTR } from "./openDTR.js";
import { openFR } from "./openFR.js";
import { openEN } from "./openEN.js";

Hooks.once("ready", async function () {
    //----------le menu liens externes
    let liensExt = new Dialog({
        title: "Besoin d'aide ?",
        content: "<p>Que voulez vous faire :</p>",
        buttons: {
            one: {
                icon: '<i class="fas fa-check"></i>',
                label: "Accéder au site de Edge-Studio",
                callback: () => openES(),
            },
            two: {
                icon: '<i class="fas fa-check"></i>',
                label: "Acheter un PDF du jeu ?",
                callback: () => openDTR(),
            },
            three: {
                icon: '<i class="fas fa-check"></i>',
                label: "Rejoindre le Discord Francophone",
                callback: () => openFR(),
            },
            four: {
                icon: '<i class="fas fa-check"></i>',
                label: "Discord Officiel FoundryVTT",
                callback: () => openEN(),
            },
        },
    });

    //------------message et logo dans console

    //----logo image
    var logo = document.getElementById("logo");
    logo.setAttribute("src", CONFIG.L5r5e.paths.assets + "l5r-logo.webp");

    //--------------ouvrir le menu lien sur click logo
    logo.setAttribute("title", "Aide en Ligne");
    logo.addEventListener("click", function () {
        liensExt.render(true);
    });
});
