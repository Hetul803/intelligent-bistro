import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Sparkles } from 'lucide-react-native';
import { useCartStore } from '../store/cartStore';
import { MenuItem } from '../types';
import { GlassCard } from './GlassCard';

export function MenuCard({ item }: { item: MenuItem }) {
  const addItem = useCartStore(state => state.addItem);
  const touched = useCartStore(state => state.items.find(i => i.id === item.id)?.lastTouchedAt || 0);
  const recentlyTouched = Date.now() - touched < 3500;

  return (
    <GlassCard className={`mb-5 ${recentlyTouched ? 'border border-cyan-300' : ''}`}>
      <View className="p-4">
        <Image source={{ uri: item.image }} className="h-44 w-full rounded-3xl bg-slate-900" />
        <View className="mt-4 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-black text-white">{item.name}</Text>
              {item.tags.includes('popular') ? <Sparkles size={16} color="#22D3EE" /> : null}
            </View>
            <Text className="mt-2 leading-6 text-slate-300">{item.description}</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {item.tags.slice(0, 3).map(tag => (
                <View key={tag} className="rounded-full bg-white/10 px-3 py-1">
                  <Text className="text-xs font-semibold uppercase text-cyan-100">{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text className="text-xl font-black text-cyan-200">${item.price.toFixed(2)}</Text>
        </View>
        <Pressable onPress={() => addItem(item)} className="mt-5 overflow-hidden rounded-2xl">
          <LinearGradient colors={['#8B5CF6', '#2563EB', '#06B6D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-row items-center justify-center gap-2 py-4">
            <Plus size={19} color="white" />
            <Text className="text-base font-black text-white">Add to Cart</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </GlassCard>
  );
}
