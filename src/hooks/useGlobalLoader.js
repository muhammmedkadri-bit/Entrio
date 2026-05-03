import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export const useGlobalLoader = (isLoading) => {
  const setPageLoading = useAppStore(s => s.setPageLoading);
  
  useEffect(() => {
    setPageLoading(isLoading);
    return () => setPageLoading(false);
  }, [isLoading, setPageLoading]);
};
