const fs = require('fs');
let code = fs.readFileSync('src/store/appStore.js', 'utf-8');

if (!code.includes('isPageLoading')) {
  code = code.replace(
    'isNavigating: true,',
    'isNavigating: true,\n  isPageLoading: false,'
  );
  code = code.replace(
    'stopNavigation: () => set({ isNavigating: false }),',
    'stopNavigation: () => set({ isNavigating: false }),\n  setPageLoading: (loading) => set({ isPageLoading: loading }),'
  );
  fs.writeFileSync('src/store/appStore.js', code);
  console.log('Updated appStore.js');
} else {
  console.log('Already updated');
}
