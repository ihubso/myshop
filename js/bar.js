console.log('🌈 Colorful authu.js loaded successfully!');    
const AdminProgressBar = {
  bar: null,
  fill: null,
  timeout: null,
  wrapper: null,
  
  init() {
    if (!document.getElementById('adminActionProgressWrapper')) {
      // Create wrapper that forces a new stacking context
      const wrapper = document.createElement('div');
      wrapper.id = 'adminActionProgressWrapper';
      wrapper.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 2147483647;
        pointer-events: none;
        isolation: isolate;
      `;
      
      // Create the progress bar inside the wrapper
      const bar = document.createElement('div');
      bar.id = 'adminActionProgress';
      bar.innerHTML = '<div id="adminActionProgressFill"></div>';
      bar.style.cssText = `
        width: 100%;
        height: 4px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.4s ease;
      `;
      
      const fill = bar.querySelector('#adminActionProgressFill');
      fill.style.cssText = `
        height: 100%;
        width: 0%;
        /* Rainbow Gradient */
        background: linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
        background-size: 400% 100%;
        animation: adminProgressRainbow 3s linear infinite;
        transition: width 0.3s cubic-bezier(0.1, 0.7, 1.0, 0.1);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.7), 0 0 5px rgba(0, 0, 0, 0.2);
        border-radius: 0 4px 4px 0;
      `;
      
      wrapper.appendChild(bar);
      document.documentElement.appendChild(wrapper);
      
      if (!document.getElementById('adminProgressStyle')) {
        const style = document.createElement('style');
        style.id = 'adminProgressStyle';
        style.textContent = `
          @keyframes adminProgressRainbow {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
          #adminActionProgressFill::after {
            content: '';
            position: absolute;
            right: 0;
            height: 100%;
            width: 50px;
            box-shadow: 0 0 15px 5px inherit;
            filter: blur(5px);
          }
          
          /* Hide progress bar when printing */
          @media print {
            #adminActionProgressWrapper {
              display: none !important;
            }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    this.wrapper = document.getElementById('adminActionProgressWrapper');
    this.bar = document.getElementById('adminActionProgress');
    this.fill = document.getElementById('adminActionProgressFill');
  },
  
  start() {
    if (!this.bar) this.init();
    if (this.timeout) clearTimeout(this.timeout);
    
    this.bar.style.opacity = '1';
    this.fill.style.width = '0%';
    this.fill.style.filter = 'hue-rotate(0deg)'; // Reset color shift
    
    setTimeout(() => {
      this.fill.style.width = '40%';
    }, 50);
    
    this.timeout = setTimeout(() => {
      this.fill.style.width = '80%';
    }, 1000);
  },
  
  complete() {
    if (!this.bar) return;
    if (this.timeout) clearTimeout(this.timeout);
    
    this.fill.style.width = '100%';
    
    this.timeout = setTimeout(() => {
      this.bar.style.opacity = '0';
      setTimeout(() => { this.fill.style.width = '0%'; }, 400);
    }, 500);
  },
  
  error() {
    if (!this.bar) return;
    if (this.timeout) clearTimeout(this.timeout);
    
    // Intense Red Error Flash
    this.fill.style.width = '100%';
    this.fill.style.background = 'repeating-linear-gradient(45deg, #ff0000, #ff0000 10px, #b91c1c 10px, #b91c1c 20px)';
    
    this.timeout = setTimeout(() => {
      this.bar.style.opacity = '0';
      setTimeout(() => {
        // Reset to rainbow
        this.fill.style.background = 'linear-gradient(90deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000)';
        this.fill.style.backgroundSize = '400% 100%';
      }, 400);
    }, 1000);
  }
};
