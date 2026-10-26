// Share links (popchi.app/p#1/name/poses) open the web app with the pack. The pack lives after
// the #, so it never reaches the website. On Android, the Popchi app opens these links itself.
location.replace('/#pack=' + location.hash.slice(1));
