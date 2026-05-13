import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BadgeCheck, Clock, Minus, Plus, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';

export function CartDock() {
  const [submitted, setSubmitted] = useState(false);
  const { items, subtotal, tax, total, updateQuantity, removeItem, undo, history } = useCartStore();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const readyMinutes = useMemo(() => Math.max(8, 7 + itemCount * 2), [itemCount]);

  useEffect(() => {
    setSubmitted(false);
  }, [itemCount]);

  return (
    <GlassCard className="mb-5">
      <View className="p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <ShoppingBag size={20} color="#FBBF24" />
            <Text className="text-xl font-black text-white">Live Order</Text>
          </View>
          <Pressable disabled={history.length === 0} onPress={undo} className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${history.length ? 'bg-white/10' : 'bg-white/5'}`}>
            <RotateCcw size={14} color={history.length ? 'white' : '#64748B'} />
            <Text className={`text-xs font-bold ${history.length ? 'text-white' : 'text-slate-500'}`}>Undo</Text>
          </Pressable>
        </View>

        <View className="mb-4 flex-row gap-2">
          <View className="flex-1 rounded-lg bg-teal-300/10 p-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-teal-100">Items</Text>
            <Text className="mt-1 text-2xl font-black text-white">{itemCount}</Text>
          </View>
          <View className="flex-1 rounded-lg bg-amber-300/10 p-3">
            <View className="flex-row items-center gap-1">
              <Clock size={13} color="#FCD34D" />
              <Text className="text-xs font-bold uppercase tracking-widest text-amber-100">Ready</Text>
            </View>
            <Text className="mt-1 text-2xl font-black text-white">{items.length ? `${readyMinutes}m` : '--'}</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <View className="rounded-lg bg-white/5 p-4">
            <Text className="font-bold text-white">Awaiting first item</Text>
            <Text className="mt-2 leading-6 text-slate-400">Ask the concierge for a combo, a dietary preference, or a price target.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {items.map(item => (
              <View key={item.id} className="rounded-lg bg-white/[0.07] p-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-black text-white">{item.name}</Text>
                    <Text className="mt-1 text-xs text-slate-400">
                      ${item.price.toFixed(2)} each {item.modifiers?.size ? ` / ${String(item.modifiers.size)}` : ''}
                    </Text>
                    {item.notes?.length ? <Text className="mt-1 text-xs font-semibold text-teal-200">{item.notes.join(', ')}</Text> : null}
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

            <View className="mt-2 h-px bg-white/10" />
            <View className="gap-2">
              <Row label="Subtotal" value={subtotal()} />
              <Row label="Tax" value={tax()} />
              <View className="flex-row items-center justify-between pt-1">
                <Text className="text-lg font-black text-white">Total</Text>
                <Text className="text-lg font-black text-cyan-200">${total().toFixed(2)}</Text>
              </View>
            </View>

            <Pressable onPress={() => setSubmitted(true)} className="mt-3 overflow-hidden rounded-lg">
              <LinearGradient colors={submitted ? ['#059669', '#14B8A6'] : ['#F97316', '#14B8A6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-row items-center justify-center gap-2 py-4">
                <BadgeCheck size={18} color="white" />
                <Text className="text-base font-black text-white">{submitted ? 'Kitchen Received' : 'Send to Kitchen'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-slate-400">{label}</Text>
      <Text className="font-semibold text-slate-200">${value.toFixed(2)}</Text>
    </View>
  );
}
