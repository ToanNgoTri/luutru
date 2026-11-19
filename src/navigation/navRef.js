import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();

// Điều hướng từ ngoài component (bấm thông báo). Nếu container chưa sẵn sàng thì đợi.
export function navigate(name, params) {
  if (navRef.isReady()) return navRef.navigate(name, params);
  const t = setInterval(() => {
    if (navRef.isReady()) {
      clearInterval(t);
      navRef.navigate(name, params);
    }
  }, 200);
  setTimeout(() => clearInterval(t), 10000);
}
