 console.log('stocksaleapp version 5.6.91'); 
 console.log('stocksaleapp version 5.6.91'); 


 // ANSI Color Codes
const GREEN = '\x1b[92m';
const YELLOW = '\x1b[93m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

console.log(GREEN + BOLD + `
███████╗████████╗██████╗  ██████╗██╗  ██╗███████╗ █████╗ ██╗     ███████╗ █████╗ ██████╗ ██████╗ 
██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗██║     ██╔════╝██╔══██╗██╔══██╗██╔══██╗
███████╗   ██║   ██║  ██║██║     █████╔╝ ███████╗███████║██║     █████╗  ███████║██████╔╝██████╔ ╝
╚════██║   ██║   ██║  ██║██║     ██╔═██╗ ╚════██║██╔══██║██║     ██╔══╝  ██╔══██║██╔═══╝ ██╔═══╝ 
███████║   ██║   ██████╔╝╚██████╗██║  ██╗███████║██║  ██║███████╗███████╗██║  ██║██║     ██║     
╚══════╝   ╚═╝   ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝     
` + RESET);

console.log(YELLOW + BOLD + `
       ██████╗██╗   ██╗
      ██╔════╝██║   ██║
      ██║     ███████║
      ██║     ╚════██║
      ╚██████╗     ██║
       ╚═════╝     ╚═╝
     ██████████████╗
     ██████████████║
     ╚══██╔═════██╔╝
        ╚═╝     ╚═╝
` + RESET);

(function() {
  // Check if we're on GitHub Pages or production
  const isProduction = window.location.hostname.includes('github.io') || 
                       !window.location.hostname.includes('localhost');
  
  if (isProduction) {
    // Disable all console methods
    const noop = function() {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
  }
})();