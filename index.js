/**
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/lib/reminders';
import { dangKyNenFcm } from './src/lib/push';

// phải đăng ký ngoài component để xử lý nút "Không" khi app đã tắt
registerBackgroundHandler();
dangKyNenFcm(); // push cảnh báo truy nã khi app tắt (chỉ cán bộ đăng ký token)

AppRegistry.registerComponent(appName, () => App);
