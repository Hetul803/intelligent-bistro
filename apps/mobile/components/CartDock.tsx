import { Pressable, Text, View } from 'react-native';
import { Minus, Plus, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { useCartStore } from '../store/cartStore';

export function CartDock() {
  const { items, subtotal, tax, total, updateQuantity, removeItem, undo, history } = useCartStore();

  return (
    <GlassCard className="mb-5">
      <View className="p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <ShoppingBag size={20} color="#C084FC" />
            <Text className="text-xl font-black text-white">Live Cart</Text>
          </View>
          <Pressable disabled={history.length === 0} onPress={undo} className="flex-row items-center gap-2 rounded-full bg-white/10 px-3 py-2">
            <RotateCcw size={14} color="white" />
            <Text className="text-xs font-bold text-white">Undo</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text className="leading-6 text-slate-400">Your cart is empty. Add items manually or ask the AI concierge to build your order.</Text>
        ) : (
          <View className="gap-3">
            {items.map(item => (
              <View key={item.id} className="rounded-2xl bg-white/7 p-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-bold text-white">{item.name}</Text>
                    <Text className="mt-1 text-xs text-slate-400">
                      ${item.price.toFixed(2)} each {item.modifiers?.size ? `• ${String(item.modifiers.size)}` : ''}
                    </Text>
                    {item.notes?.length ? <Text className="mt-1 text-xs text-cyan-200">Notes: {item.notes.join(', ')}</Text> : null}
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
