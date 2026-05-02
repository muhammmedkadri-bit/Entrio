const fs = require('fs');
let code = fs.readFileSync('src/components/ui/GlobalFAB.jsx', 'utf-8');

const observerCode = `
  const [hasSpinner, setHasSpinner] = useState(false);

  useEffect(() => {
    const checkSpinner = () => {
      // "Yükleniyor..." spinners inside the page content
      const spinner = document.querySelector('.animate-spin');
      setHasSpinner(!!spinner);
    };
    checkSpinner();
    const observer = new MutationObserver(checkSpinner);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
`;

// Insert the observer logic before the menuRef declaration or somewhere safe inside the component
code = code.replace(
  '  const menuRef = useRef(null);',
  `  const menuRef = useRef(null);\n${observerCode}`
);

// Update the hiding condition to include hasSpinner
code = code.replace(
  '(isNavigating || isPageLoading)',
  '(isNavigating || isPageLoading || hasSpinner)'
);

fs.writeFileSync('src/components/ui/GlobalFAB.jsx', code);
console.log('GlobalFAB patched with MutationObserver');
