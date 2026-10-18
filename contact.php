<?php
/**
 * Auto-M · réception du formulaire de devis / rendez-vous.
 *
 * - GET  contact.php?etat=1 : indique au site si l'envoi est configuré (JSON).
 * - POST contact.php        : valide la demande et l'envoie par e-mail au garage.
 *
 * Aucune donnée n'est enregistrée sur le serveur : la demande est seulement transmise par e-mail.
 * Nécessite PHP 8.1+ et la fonction mail() (disponible chez les hébergeurs mutualisés suisses courants).
 */
declare(strict_types=1);

const PRESTATIONS = [
    'Entretien et service',
    'Mécanique et diagnostic',
    'Électricité et électronique',
    'Carrosserie et vitrage',
    'Climatisation',
    'Jantes et pneus',
    "Préparation à l'expertise",
    'Vente de véhicules',
    'Autre demande',
];
const TELEPHONE_GARAGE = '026 558 98 52';

$config = require __DIR__ . '/config.php';
$destinataire = trim((string) ($config['destinataire'] ?? ''));
$expediteur   = trim((string) ($config['expediteur'] ?? ''));
$configure    = filter_var($destinataire, FILTER_VALIDATE_EMAIL) !== false
             && filter_var($expediteur, FILTER_VALIDATE_EMAIL) !== false;

$veutJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** Envoie la réponse (JSON pour le site, page HTML simple si JavaScript est désactivé) et termine. */
function repondre(int $code, array $donnees, bool $json): never
{
    http_response_code($code);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $titre = !empty($donnees['ok']) ? 'Demande envoyée' : 'Demande non envoyée';
    $texte = $donnees['message'] ?? '';
    if (!empty($donnees['errors'])) {
        $texte .= ' ' . implode(' ', $donnees['errors']);
    }
    $e = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo '<!doctype html><html lang="fr-CH"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex"><title>' . $e($titre) . ' · Auto-M</title>'
       . '<link rel="stylesheet" href="css/style.css"></head><body>'
       . '<main class="section"><div class="container legal"><h1>' . $e($titre) . '</h1>'
       . '<p>' . $e(trim($texte)) . '</p>'
       . '<p><a class="btn btn--primary" href="index.html#devis">Retour au site</a></p>'
       . '</div></main></body></html>';
    exit;
}

/** Nettoie une valeur texte : supprime les caractères de contrôle (retours à la ligne autorisés si $multiligne). */
function nettoyer(mixed $valeur, bool $multiligne = false): string
{
    $v = is_string($valeur) ? $valeur : '';
    $v = $multiligne
        ? preg_replace('/[^\P{C}\n\t]/u', '', str_replace("\r\n", "\n", $v))
        : preg_replace('/\p{C}/u', '', $v);
    return trim((string) $v);
}

// --- État de configuration (utilisé par le site pour activer le formulaire) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['etat'])) {
    repondre(200, ['configured' => $configure], true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    repondre(405, ['ok' => false, 'message' => 'Méthode non autorisée.'], $veutJson);
}

// Refuse les envois provenant d'un autre site.
$origine = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origine !== '' && parse_url($origine, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    repondre(403, ['ok' => false, 'message' => 'Requête refusée.'], $veutJson);
}

if (!$configure) {
    repondre(503, [
        'ok' => false,
        'code' => 'not_configured',
        'message' => "Le formulaire en ligne n'est pas encore activé. Appelez-nous au " . TELEPHONE_GARAGE . '.',
    ], $veutJson);
}

// --- Anti-spam : champ piège rempli ou envoi trop rapide → on répond « ok » sans rien envoyer ---
$delai = is_string($_POST['t'] ?? null) ? $_POST['t'] : '';
if (nettoyer($_POST['site_web'] ?? '') !== '' || (ctype_digit($delai) && (int) $delai < 3)) {
    repondre(200, ['ok' => true, 'message' => 'Merci, votre demande a bien été envoyée.'], $veutJson);
}

// --- Validation côté serveur ---
$nom        = nettoyer($_POST['nom'] ?? '');
$telephone  = nettoyer($_POST['telephone'] ?? '');
$email      = nettoyer($_POST['email'] ?? '');
$vehicule   = nettoyer($_POST['vehicule'] ?? '');
$prestation = nettoyer($_POST['prestation'] ?? '');
$date       = nettoyer($_POST['date_souhaitee'] ?? '');
$message    = nettoyer($_POST['message'] ?? '', true);

$erreurs = [];
if ($nom === '' || mb_strlen($nom) > 100) {
    $erreurs['nom'] = 'Indiquez votre nom (100 caractères maximum).';
}
if (!preg_match('/^[0-9+()\s.\/-]{9,25}$/', $telephone) || strlen(preg_replace('/\D/', '', $telephone)) < 9) {
    $erreurs['telephone'] = 'Indiquez un numéro de téléphone valide.';
}
if ($email !== '' && (mb_strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false)) {
    $erreurs['email'] = 'Cette adresse e-mail ne semble pas valide.';
}
if (mb_strlen($vehicule) > 120) {
    $erreurs['vehicule'] = 'Description du véhicule trop longue.';
}
if (!in_array($prestation, PRESTATIONS, true)) {
    $erreurs['prestation'] = 'Choisissez une prestation.';
}
if ($date !== '') {
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if ($d === false || $d->format('Y-m-d') !== $date) {
        $erreurs['date_souhaitee'] = 'Date non valide.';
    }
}
$longueur = mb_strlen($message);
if ($longueur < 10 || $longueur > 2000) {
    $erreurs['message'] = 'Votre message doit contenir entre 10 et 2000 caractères.';
}

if ($erreurs) {
    repondre(422, ['ok' => false, 'message' => 'Certains champs sont à corriger.', 'errors' => $erreurs], $veutJson);
}

// --- Envoi de l'e-mail au garage ---
mb_internal_encoding('UTF-8');
$sujet = mb_encode_mimeheader("Demande de devis : $prestation – $nom", 'UTF-8', 'Q');

$corps = "Nouvelle demande reçue depuis le site Auto-M\n"
       . str_repeat('-', 44) . "\n"
       . "Nom : $nom\n"
       . "Téléphone : $telephone\n"
       . 'E-mail : ' . ($email !== '' ? $email : '(non indiqué)') . "\n"
       . 'Véhicule : ' . ($vehicule !== '' ? $vehicule : '(non indiqué)') . "\n"
       . "Prestation : $prestation\n"
       . 'Date souhaitée : ' . ($date !== '' ? (new DateTimeImmutable($date))->format('d.m.Y') : '(non indiquée)') . "\n\n"
       . "Message :\n$message\n";

$entetes = [
    'From' => 'Site Auto-M <' . $expediteur . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
];
if ($email !== '') {
    // Adresse validée par FILTER_VALIDATE_EMAIL : pas d'injection d'en-tête possible.
    $entetes['Reply-To'] = $email;
}

if (!mail($destinataire, $sujet, $corps, $entetes)) {
    repondre(500, [
        'ok' => false,
        'message' => "L'envoi n'a pas abouti pour une raison technique. Appelez-nous au " . TELEPHONE_GARAGE . '.',
    ], $veutJson);
}

repondre(200, [
    'ok' => true,
    'message' => "Merci, votre demande a bien été envoyée. Nous vous rappelons pendant nos heures d'ouverture.",
], $veutJson);
