import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const sendCrashLog = async (errorMessage: string) => {
    try {
        const state = useAuthStore.getState();
        const activeSite = state.activeSite?.url || 'سایت نامشخص';
        
        // ارسال بی‌صدا به مرکز فرماندهی (فیتلا)
        await axios.post('https://fitla.ir/wp-json/pishmo-license/v1/crash-log', {
            username: 'کاربر پیشمو', 
            phone: '09981212531', // به صورت موقت هاردکد شد
            site: activeSite,
            error: errorMessage
        });
    } catch (e) {
        // هیچ کاری نمی‌کنیم تا کاربر متوجه نشود
    }
};