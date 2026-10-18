# Site Auto-M · Garage Carrosserie Multimarques, Fribourg

Site vitrine statique (HTML, CSS, JavaScript), sans framework ni dépendance.
Un script PHP envoie les demandes de devis par e-mail.

## Structure

```
index.html                  Page principale (accueil, prestations, garage, devis, horaires)
informations-legales.html   Mentions légales + politique de confidentialité (modèle)
css/style.css               Styles (mobile-first)
js/main.js                  Menu mobile, statut ouvert/fermé, formulaire
contact.php                 Réception et envoi du formulaire (PHP 8.1+)
config.php                  Adresses e-mail du formulaire (à compléter)
.htaccess                   Sécurité, cache, compression (Apache)
robots.txt, sitemap.xml     Référencement (domaine à compléter)
favicon.svg                 Icône provisoire
assets/fonts/               Polices WOFF2 + licences OFL
assets/img/provisoire/      Logo et photos PROVISOIRES (droits à obtenir)
```

## Lancer en local

- **Aperçu sans formulaire** : `python3 -m http.server 8000`, puis http://localhost:8000.
  Le formulaire s'affiche désactivé, avec le message « appelez-nous » : c'est le comportement attendu sans PHP.
- **Avec le formulaire** : `php -S localhost:8000` (PHP 8.1+). Le serveur intégré de PHP n'envoie
  pas d'e-mails réels sans configuration de `sendmail`. Testez l'envoi sur l'hébergement.

## Activer le formulaire

1. Ouvrir `config.php`.
2. Renseigner `destinataire` : l'adresse du garage qui reçoit les demandes.
3. Renseigner `expediteur` : une adresse **du domaine du site** (ex. `formulaire@domaine.ch`), créée chez l'hébergeur.
4. Mettre en ligne, puis envoyer une demande de test.

Tant que ces adresses sont vides, le site désactive le formulaire et renvoie vers le téléphone.

## Mise en ligne

- Hébergement **Apache avec PHP 8.1+** requis (ex. Infomaniak, Hostpoint). Sur un hébergement sans PHP,
  `contact.php` serait servi comme un simple fichier texte : ne pas l'utiliser ainsi.
- Ne pas téléverser le dossier `.claude/` (outil de développement local). `.htaccess` bloque de toute façon
  les dossiers cachés et `README.md`.
- Le script inline du `<head>` est autorisé dans la CSP de `.htaccess` par son empreinte (hash sha256).
  Si ce script est modifié, l'empreinte doit être recalculée, sinon le navigateur le bloquera.

## Éléments provisoires

- Le mode révision est actif : attribut `data-review` sur `<html>` dans les deux pages HTML.
  Il affiche les étiquettes jaunes « À confirmer » et les blocs `[À COMPLÉTER]`.
  **Le retirer avant la mise en ligne**, une fois les contenus validés.
- Pour tout retrouver : `grep -rn "PROVISOIRE\|À COMPLÉTER\|À AJOUTER\|DOMAINE-A-DEFINIR\|review-tag" .`

## Remplacer une image

Déposer le nouveau fichier (idéalement en WebP, environ 1600 px de large pour l'accueil, 1000 px pour les autres),
mettre à jour `src`, `width`, `height` et `alt` dans `index.html`. Ensuite, supprimer l'étiquette
`review-tag--media` et déplacer le fichier hors du dossier `provisoire/`.

## Horaires

Les horaires se modifient à un seul endroit pour l'affichage : les attributs `data-hours` du tableau dans
`index.html`. Le statut « Ouvert / Fermé » en est calculé. Mettre aussi à jour le texte visible du tableau et le
bloc JSON-LD (`openingHoursSpecification`) dans `<head>`.
