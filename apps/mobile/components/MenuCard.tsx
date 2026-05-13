import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Leaf, Plus, Sparkles } from 'lucide-react-native';
import { useCartStore } from '../store/cartStore';
import { MenuItem } from '../types';
import { GlassCard } from './GlassCard';

export function MenuCard({ item, isSuggested = false }: { item: MenuItem; isSuggested?: boolean }) {
  const addItem = useCartStore(state => state.addItem);
  const touched = useCartStore(state => state.items.find(i => i.id === item.id)?.lastTouchedAt || 0);
  const recentlyTouched = Date.now() - touched < 3500;
  const isVegetarian = item.tags.includes('vegetarian');

  return (
    <GlassCard className={`mb-5 ${recentlyTouched || isSuggested ? 'border border-teal-300/70' : ''}`}>
      <View className="p-3">
        <View className="overflow-hidden rounded-lg bg-slate-950">
          <Image source={{ uri: item.image }} className="h-44 w-full bg-slate-900" />
          <LinearGradient colors={['transparent', 'rgba(2,6,23,0.82)']} className="absolute inset-x-0 bottom-0 h-24" />
          <View className="absolute left-3 top-3 flex-row gap-2">
            {item.tags.includes('popular') ? (
              <View className="flex-row items-center gap-1 rounded-full bg-teal-300/90 px-3 py-1">
                <Sparkles size={12} color="#042F2E" />
                <Text className="text-xs font-black text-teal-950">POPULAR</Text>
              </View>
            ) : null}
            {isSuggested ? (
              <View className="rounded-full bg-amber-300/90 px-3 py-1">
                <Text className="text-xs font-black text-amber-950">AI PICK</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View className="mt-4 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-black text-white">{item.name}</Text>
            </View>
            <Text className="mt-2 leading-6 text-slate-300">{item.description}</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {isVegetarian ? (
                <View className="flex-row items-center gap-1 rounded-full bg-emerald-300/15 px-3 py-1">
                  <Leaf size={12} color="#A7F3D0" />
                  <Text className="text-xs font-black uppercase text-emerald-100">plant</Text>
                </View>
              ) : null}
              {item.spiceLevel > 0 ? (
                <View className="flex-row items-center gap-1 rounded-full bg-orange-300/15 px-3 py-1">
                  <Flame size={12} color="#FDBA74" />
                  <Text className="text-xs font-black uppercase text-orange-100">heat {item.spiceLevel}</Text>
                </View>
              ) : null}
              {item.tags.slice(0, 3).map(tag => (
                <View key={tag} className="rounded-full bg-white/10 px-3 py-1">
                  <Text className="text-xs font-semibold uppercase text-slate-100">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text className="text-xl font-black text-amber-100">${item.price.toFixed(2)}</Text>
        </View>
        <Pressable onPress={() => addItem(item)} className="mt-5 overflow-hidden rounded-lg">
          <LinearGradient colors={['#14B8A6', '#2563EB', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-row items-center justify-center gap-2 py-4">
            <Plus size={19} color="white" />
            <Text className="text-base font-black text-white">Add to Cart</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </GlassCard>
  );
}
