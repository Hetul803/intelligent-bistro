import { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cpu, Filter, Orbit, Sparkles, X, Zap } from 'lucide-react-native';
import { menu } from '../constants/menu';
import { Category } from '../types';
import { MenuCard } from '../components/MenuCard';
import { AIConcierge } from '../components/AIConcierge';
import { CartDock } from '../components/CartDock';
import { useCartStore } from '../store/cartStore';

const categories: Array<Category | 'All'> = ['All', 'Sandwiches', 'Bowls', 'Sides', 'Drinks', 'Desserts'];

export default function HomeScreen() {
  const [category, setCategory] = useState<Category | 'All'>('All');
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const activeFilter = useCartStore(state => state.activeFilter);
  const clearFilter = useCartStore(state => state.clearFilter);
  const lastSuggestedItems = useCartStore(state => state.lastSuggestedItems);
  const itemCount = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0));

  const visibleMenu = useMemo(() => {
    const activeCategory = categories.find(cat => cat !== 'All' && cat.toLowerCase() === activeFilter?.toLowerCase());
    let items = category === 'All' ? menu : menu.filter(item => item.category === category);
    if (activeCategory && activeCategory !== 'All') items = items.filter(item => item.category === activeCategory);
    if (activeFilter === 'vegetarian') items = items.filter(item => item.tags.includes('vegetarian'));
    if (activeFilter === 'popular') items = items.filter(item => item.tags.includes('popular'));
    return items;
  }, [category, activeFilter]);

  const menuSection = (
    <View>
      <View className="mb-4 flex-row items-center justify-between gap-4">
        <View>
          <Text className="text-2xl font-black text-white">Menu Matrix</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-400">{visibleMenu.length} items calibrated</Text>
        </View>
        <View className="rounded-full bg-white/10 px-3 py-2">
          <Text className="text-xs font-black text-white">{itemCount} IN ORDER</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
        <View className="flex-row gap-2 pr-5">
          {categories.map(cat => {
            const selected = category === cat;
            return (
              <Pressable key={cat} onPress={() => setCategory(cat)} className={`rounded-full px-4 py-3 ${selected ? 'bg-teal-300' : 'bg-white/10'}`}>
                <Text className={`font-black ${selected ? 'text-slate-950' : 'text-slate-100'}`}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {activeFilter ? (
        <View className="mb-4 flex-row items-center justify-between gap-3 rounded-lg bg-teal-300/10 p-4">
          <View className="flex-row flex-1 items-center gap-2">
            <Filter size={16} color="#5EEAD4" />
            <Text className="font-semibold text-teal-100">AI filter: {activeFilter}</Text>
          </View>
          <Pressable onPress={clearFilter} className="rounded-full bg-white/10 p-2">
            <X size={15} color="white" />
          </Pressable>
        </View>
      ) : null}

      {visibleMenu.map(item => (
        <MenuCard key={item.id} item={item} isSuggested={lastSuggestedItems.includes(item.id)} />
      ))}
    </View>
  );

  const hero = (
    <ImageBackground
      source={{ uri: menu[0].image }}
      resizeMode="cover"
      imageStyle={{ opacity: 0.34 }}
      className="mb-5 overflow-hidden rounded-lg bg-slate-950"
    >
      <LinearGradient colors={['rgba(2,6,23,0.96)', 'rgba(15,23,42,0.78)', 'rgba(20,83,45,0.66)']} className="p-5" style={{ minHeight: isWide ? 280 : 330 }}>
        <View className="flex-1 justify-between">
          <View>
            <View className="mb-4 flex-row items-center gap-2">
              <Orbit size={18} color="#5EEAD4" />
              <Text className="text-xs font-black uppercase tracking-[3px] text-teal-100">Future Dining OS</Text>
            </View>
            <Text className="text-5xl font-black leading-tight text-white">Intelligent Bistro</Text>
            <Text className="mt-3 max-w-xl text-base font-semibold leading-7 text-slate-200">
              Conversational ordering with a cart that reacts to intent, dietary context, and live modifications.
            </Text>
          </View>

          <View className="mt-8 flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-2 rounded-full bg-black/35 px-4 py-3">
              <Cpu size={16} color="#FCD34D" />
              <Text className="text-xs font-black text-amber-100">ZOD VALIDATED</Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full bg-black/35 px-4 py-3">
              <Zap size={16} color="#FB923C" />
              <Text className="text-xs font-black text-orange-100">DEMO RELIABLE</Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full bg-black/35 px-4 py-3">
              <Sparkles size={16} color="#5EEAD4" />
              <Text className="text-xs font-black text-teal-100">AI NATIVE</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );

  return (
    <LinearGradient colors={['#020617', '#0F172A', '#052E2B', '#111827']} className="flex-1">
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: isWide ? 28 : 20, paddingBottom: 32 }}>
          <View className="pt-5" style={{ alignSelf: 'center', maxWidth: 1180, width: '100%' }}>
            {isWide ? (
              <View className="flex-row items-start gap-5">
                <View className="flex-1">
                  {hero}
                  {menuSection}
                </View>
                <View style={{ width: 400 }}>
                  <AIConcierge />
                  <CartDock />
                </View>
              </View>
            ) : (
              <>
                {hero}
                <AIConcierge />
                <CartDock />
                {menuSection}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
