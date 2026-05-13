import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cpu, Orbit, Sparkles } from 'lucide-react-native';
import { menu } from '../constants/menu';
import { Category } from '../types';
import { MenuCard } from '../components/MenuCard';
import { AIConcierge } from '../components/AIConcierge';
import { CartDock } from '../components/CartDock';
import { useCartStore } from '../store/cartStore';

const categories: Array<Category | 'All'> = ['All', 'Sandwiches', 'Bowls', 'Sides', 'Drinks', 'Desserts'];

export default function HomeScreen() {
  const [category, setCategory] = useState<Category | 'All'>('All');
  const activeFilter = useCartStore(state => state.activeFilter);

  const visibleMenu = useMemo(() => {
    let items = category === 'All' ? menu : menu.filter(item => item.category === category);
    if (activeFilter === 'vegetarian') items = items.filter(item => item.tags.includes('vegetarian'));
    return items;
  }, [category, activeFilter]);

  return (
    <LinearGradient colors={['#050816', '#0B1026', '#111936', '#050816']} className="flex-1">
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="pt-5">
            <View className="mb-8 flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <View className="mb-3 flex-row items-center gap-2">
                  <Orbit size={18} color="#22D3EE" />
                  <Text className="text-xs font-black uppercase tracking-[3px] text-cyan-200">Future Dining OS</Text>
                </View>
                <Text className="text-5xl font-black leading-tight text-white">Intelligent Bistro</Text>
                <Text className="mt-3 text-base leading-7 text-slate-300">A conversational restaurant experience where the cart listens, reasons, and updates instantly.</Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/10">
                <Cpu size={25} color="white" />
              </View>
            </View>

            <LinearGradient colors={['rgba(124,58,237,0.45)', 'rgba(6,182,212,0.25)', 'rgba(255,255,255,0.06)']} className="mb-6 rounded-[32px] p-5">
              <View className="flex-row items-center gap-2">
                <Sparkles size={18} color="#E9D5FF" />
                <Text className="text-sm font-black uppercase tracking-widest text-violet-100">AI-managed ordering</Text>
              </View>
              <Text className="mt-3 text-2xl font-black leading-9 text-white">Speak naturally. The assistant converts intent into validated cart actions.</Text>
            </LinearGradient>

            <AIConcierge />
            <CartDock />

            <Text className="mb-4 text-2xl font-black text-white">Menu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <View className="flex-row gap-2 pr-5">
                {categories.map(cat => {
                  const selected = category === cat;
                  return (
                    <Pressable key={cat} onPress={() => setCategory(cat)} className={`rounded-full px-4 py-3 ${selected ? 'bg-cyan-400' : 'bg-white/10'}`}>
                      <Text className={`font-black ${selected ? 'text-slate-950' : 'text-slate-100'}`}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {activeFilter ? (
              <View className="mb-4 rounded-2xl bg-cyan-400/10 p-4">
                <Text className="font-semibold text-cyan-100">AI filter active: {activeFilter}</Text>
              </View>
            ) : null}

            {visibleMenu.map(item => <MenuCard key={item.id} item={item} />)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
