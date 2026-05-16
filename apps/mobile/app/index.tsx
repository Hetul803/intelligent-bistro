import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, Filter, MessageCircle, ShoppingBag, Utensils, X } from 'lucide-react-native';
import { menu } from '../constants/menu';
import { Category } from '../types';
import { MenuCard } from '../components/MenuCard';
import { AIConcierge } from '../components/AIConcierge';
import { CartDock } from '../components/CartDock';
import { useCartStore } from '../store/cartStore';

const categories: Array<Category | 'All'> = ['All', 'Sandwiches', 'Bowls', 'Sides', 'Drinks', 'Desserts'];

export default function HomeScreen() {
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [viewMode, setViewMode] = useState<'ai' | 'menu'>('ai');
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
    if (activeFilter === 'gluten-free') items = items.filter(item => item.tags.includes('gluten-free'));
    if (activeFilter === 'popular') items = items.filter(item => item.tags.includes('popular'));
    return items;
  }, [category, activeFilter]);

  const menuSection = (
    <View>
      <View className="mb-4 flex-row items-center justify-between gap-4">
        <View>
          <Text className="text-2xl font-black text-white">Menu</Text>
          <Text className="mt-1 text-sm font-semibold text-slate-400">{visibleMenu.length} items available when you want to browse manually</Text>
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

      <View className={isWide ? 'flex-row flex-wrap justify-between' : ''}>
        {visibleMenu.map(item => (
          <View key={item.id} style={{ width: isWide ? '48.8%' : '100%' }}>
            <MenuCard item={item} isSuggested={lastSuggestedItems.includes(item.id)} />
          </View>
        ))}
      </View>
    </View>
  );

  const topBar = (
    <View className="mb-5 rounded-lg border border-white/10 bg-slate-950/55 p-4">
      <View className="flex-row items-center gap-3">
        <LinearGradient colors={['#14B8A6', '#F97316']} className="h-11 w-11 items-center justify-center rounded-lg">
          <Bot size={21} color="white" />
        </LinearGradient>
        <View className="flex-1">
          <Text className="text-2xl font-black text-white">Intelligent Bistro</Text>
          <Text className="mt-1 text-xs font-black uppercase tracking-widest text-teal-100">AI is the front door</Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={() => setViewMode('ai')} className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${viewMode === 'ai' ? 'bg-teal-300' : 'bg-white/10'}`}>
            <MessageCircle size={14} color={viewMode === 'ai' ? '#020617' : 'white'} />
            <Text className={`text-xs font-black ${viewMode === 'ai' ? 'text-slate-950' : 'text-white'}`}>AI</Text>
          </Pressable>
          <Pressable onPress={() => setViewMode('menu')} className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${viewMode === 'menu' ? 'bg-amber-300' : 'bg-white/10'}`}>
            <Utensils size={14} color={viewMode === 'menu' ? '#020617' : 'white'} />
            <Text className={`text-xs font-black ${viewMode === 'menu' ? 'text-slate-950' : 'text-white'}`}>Menu</Text>
          </Pressable>
        </View>
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-2 rounded-full bg-black/35 px-4 py-3">
          <Bot size={15} color="#5EEAD4" />
          <Text className="text-xs font-black text-teal-100">CHAT-FIRST ORDERING</Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-full bg-black/35 px-4 py-3">
          <ShoppingBag size={15} color="#FCD34D" />
          <Text className="text-xs font-black text-amber-100">{itemCount} IN ORDER</Text>
        </View>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#020617', '#0F172A', '#052E2B', '#111827']} className="flex-1">
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: isWide ? 28 : 20, paddingBottom: 32 }}>
          <View className="pt-5" style={{ alignSelf: 'center', maxWidth: 1180, width: '100%' }}>
            {topBar}
            {viewMode === 'ai' ? (
              isWide ? (
                <View className="flex-row items-start gap-5">
                  <View className="flex-1">
                    <AIConcierge />
                  </View>
                  <View style={{ width: 380 }}>
                    <CartDock />
                  </View>
                </View>
              ) : (
                <>
                  <AIConcierge />
                  <CartDock />
                </>
              )
            ) : (
              <>
                <View className={isWide ? 'flex-row items-start gap-5' : ''}>
                  <View className="flex-1">{menuSection}</View>
                  {isWide ? (
                    <View style={{ width: 380 }}>
                      <CartDock />
                    </View>
                  ) : (
                    <CartDock />
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
