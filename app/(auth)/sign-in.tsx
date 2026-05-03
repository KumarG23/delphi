import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  fontSize, fontWeight, letterSpacing, radius, space, themeDark,
} from '@/constants/tokens';

const T = themeDark;

export default function SignInScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(friendlyError(error.message));
    // On success, onAuthStateChange in _layout fires → redirect happens automatically
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wordmark */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>Delphi</Text>
          <Text style={styles.tagline}>Your full money picture, at a glance.</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={T.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={T.textDim}
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={T.primaryFg} />
              : <Text style={styles.buttonText}>Sign in</Text>
            }
          </Pressable>
        </View>

        {/* Sign-up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Invalid email or password.';
  if (msg.includes('Email not confirmed'))       return 'Please confirm your email first.';
  if (msg.includes('network'))                   return 'Network error. Check your connection.';
  return msg;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space['8'],
    paddingVertical: space['20'],
  },
  header: {
    alignItems: 'center',
    marginBottom: space['16'],
  },
  wordmark: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.extrabold,
    color: T.primary,
    letterSpacing: letterSpacing.tightest,
    marginBottom: space['2'],
  },
  tagline: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    letterSpacing: letterSpacing.wide,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['12'],
    gap: space['6'],
  },
  cardTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
    marginBottom: space['2'],
  },
  field: { gap: space['2'] },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.widest,
  },
  input: {
    height: 48,
    backgroundColor: T.cardSoft,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.md,
    paddingHorizontal: space['8'],
    fontSize: fontSize.md,
    color: T.text,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: T.danger,
    marginTop: space['1'],
  },
  button: {
    height: 48,
    backgroundColor: T.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space['2'],
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: space['12'],
  },
  footerText: { fontSize: fontSize.sm, color: T.textMuted },
  footerLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: T.primary,
  },
});
