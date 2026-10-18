<?php
/**
 * Configuration du formulaire de devis.
 * Tant que ces deux adresses sont vides, le formulaire reste désactivé sur le site
 * et invite les visiteurs à téléphoner.
 * L'accès direct à ce fichier est bloqué par .htaccess (et il n'affiche rien).
 */
return [
    // À COMPLÉTER : adresse qui reçoit les demandes (celle du garage).
    'destinataire' => '',

    // À COMPLÉTER : adresse d'expédition sur le domaine du site (ex. formulaire@votre-domaine.ch).
    // Elle doit appartenir au domaine hébergé, sinon les e-mails risquent de finir en spam.
    'expediteur' => '',
];
