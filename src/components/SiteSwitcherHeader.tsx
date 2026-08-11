import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';

export const SiteSwitcherHeader: React.FC = () => {
    const navigation = useNavigation<any>();
    const { sites, activeSite, switchSite } = useAuthStore();
    const [modalVisible, setModalVisible] = useState(false);

    // اگر سایتی نبود چیزی رندر نکن
    if (!activeSite) return null;

    const handleSwitch = async (siteId: string) => {
        await switchSite(siteId);
        setModalVisible(false);
    };

    const handleAddNewSite = () => {
        setModalVisible(false);
        // هدایت کاربر به صفحه اسکن بارکد (اسم صفحه لاگین خودت رو اینجا جایگزین کن اگه متفاوته)
        navigation.navigate('LoginScreen'); 
    };

    return (
        <>
            {/* هدر بالای صفحه */}
            <View style={styles.headerContainer}>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.siteName} numberOfLines={1}>{activeSite.name || 'فروشگاه من'}</Text>
                        <Text style={styles.siteUrl} numberOfLines={1}>{activeSite.url.replace('https://', '')}</Text>
                    </View>
                    <Feather name="chevron-down" size={20} color="#0f172a" style={styles.icon} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.notificationBtn}>
                    <Feather name="bell" size={20} color="#64748b" />
                </TouchableOpacity>
            </View>

            {/* مودال کشویی لیست سایت‌ها */}
            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.dragHandle} />
                        <Text style={styles.sheetTitle}>انتخاب فروشگاه</Text>
                        
                        <FlatList
                            data={sites}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isActive = item.id === activeSite.id;
                                return (
                                    <TouchableOpacity 
                                        style={[styles.siteItem, isActive && styles.siteItemActive]} 
                                        onPress={() => handleSwitch(item.id)}
                                    >
                                        <View style={styles.siteItemIcon}>
                                            {isActive ? (
                                                <Feather name="check-circle" size={22} color="#10b981" />
                                            ) : (
                                                <View style={styles.circlePlaceholder} />
                                            )}
                                        </View>
                                        <View style={styles.siteItemDetails}>
                                            <Text style={[styles.siteItemName, isActive && { color: '#10b981' }]} numberOfLines={1}>
                                                {item.name || 'فروشگاه'}
                                            </Text>
                                            <Text style={styles.siteItemUrl} numberOfLines={1}>{item.url}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        {/* دکمه افزودن سایت جدید */}
                        <TouchableOpacity style={styles.addNewBtn} onPress={handleAddNewSite}>
                            <Feather name="plus" size={20} color="#3b82f6" />
                            <Text style={styles.addNewTxt}>افزودن فروشگاه جدید</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 20, // فضای امن برای ناچ گوشی
        paddingBottom: 15,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownButton: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        flex: 1,
    },
    titleContainer: {
        alignItems: 'flex-end',
        marginRight: 8,
    },
    siteName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
    },
    siteUrl: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: 'bold',
        marginTop: 2,
    },
    icon: {
        marginRight: 4,
    },
    notificationBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '70%',
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#cbd5e1',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 20,
    },
    siteItem: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    siteItemActive: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
    },
    siteItemIcon: {
        marginLeft: 15,
    },
    circlePlaceholder: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#cbd5e1',
    },
    siteItemDetails: {
        flex: 1,
        alignItems: 'flex-end',
    },
    siteItemName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 4,
    },
    siteItemUrl: {
        fontSize: 11,
        color: '#94a3b8',
    },
    addNewBtn: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    addNewTxt: {
        fontSize: 14,
        fontWeight: '900',
        color: '#3b82f6',
        marginRight: 8,
    },
});