import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BadgeCheck, Minus, Plus, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';

export function CartDock() {
  const [submitted, setSubmitted] = useState(false);
  const { items, total, updateQuantity, removeItem, undo, history } = useCartStore();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const readyMinutes = useMemo(() => Math.max(8, 7 + itemCount * 2), [itemCount]);

  useEffect(() => {
    setSubmitted(false);
  }, [itemCount]);

  return (
    <GlassCard className="mb-4 border border-amber-300/20">
      <View className="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <ShoppingBag size={20} color="#FBBF24" />
            <Text className="text-xl font-black text-white">Your order</Text>
          </View>
          <Pressable disabled={history.length === 0} onPress={undo} className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${history.length ? 'bg-white/10' : 'bg-white/5'}`}>
            <RotateCcw size={14} color={history.length ? 'white' : '#64748B'} />
            <Text className={`text-xs font-bold ${history.length ? 'text-white' : 'text-slate-500'}`}>Undo</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <View className="rounded-lg bg-white/5 p-3">
            <Text className="font-bold text-white">Empty for now</Text>
            <Text className="mt-1 text-sm leading-5 text-slate-400">Ask once. The concierge will build it.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map(item => (
              <View key={item.id} className="rounded-lg bg-white/[0.07] p-2.5">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-black text-white">{item.name}</Text>
                    <Text className="mt-1 text-xs text-slate-400" numberOfLines={2}>
                      ${item.price.toFixed(2)} each · ready in {readyMinutes}m {item.modifiers?.size ? `· ${String(item.modifiers.size)}` : ''}
                    </Text>
                    {item.modifiers?.remove ? (
                      <Text className="mt-1 text-xs font-semibold text-orange-100" numberOfLines={2}>Removed: {String((item.modifiers.remove as string[]).join(', '))}</Text>
                    ) : null}
                    {item.modifiers?.addOns ? (
                      <Text className="mt-1 text-xs font-semibold text-amber-100" numberOfLines={2}>Added: {String((item.modifiers.addOns as string[]).join(', '))}</Text>
                    ) : null}
                    {item.notes?.length ? <Text className="mt-1 text-xs font-semibold text-teal-200" numberOfLines={2}>{item.notes.join(', ')}</Text> : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable onPress={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-full bg-white/10 p-2"><Minus size={14} color="white" /></Pressable>
                    <Text className="min-w-5 text-center font-black text-white">{item.quantity}</Text>
                    <Pressable onPress={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-full bg-white/10 p-2"><Plus size={14} color="white" /></Pressable>
                    <Pressable onPress={() => removeItem(item.id)} className="rounded-full bg-red-500/20 p-2"><Trash2 size={14} color="#FCA5A5" /></Pressable>
                  </View>
                </View>
              </View>
            ))}

            <View className="mt-2 flex-row items-center justify-between rounded-lg bg-black/30 p-3">
              <View>
                <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">{itemCount} item{itemCount === 1 ? '' : 's'} · tax included</Text>
                <Text className="mt-1 text-2xl font-black text-white">${total().toFixed(2)}</Text>
              </View>
              <Text className="text-sm font-black text-amber-100">{readyMinutes}m</Text>
            </View>

            <Pressable onPress={() => setSubmitted(true)} className="mt-2 overflow-hidden rounded-lg">
              <LinearGradient colors={submitted ? ['#059669', '#14B8A6'] : ['#F97316', '#14B8A6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-row items-center justify-center gap-2 py-4">
                <BadgeCheck size={18} color="white" />
                <Text className="text-base font-black text-white">{submitted ? 'Kitchen Received' : 'Approve AI Order'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

