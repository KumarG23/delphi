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

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [confirmed, setConfirmed]     = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim())       { setError('Please enter your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    setLoading(false);

    if (error) {
      setError(friendlyError(error.message));
    } else {
      // Supabase sends a confirmation email by default.
      // If email confirm is disabled in your project, onAuthStateChange fires immediately.
      setConfirmed(true);
    }
  }

  if (confirmed) {
    return (
      <View style={styles.confirmedContainer}>
        <Text style={styles.wordmark}>Delphi</Text>
        <View style={styles.confirmedCard}>
          <Text style={styles.confirmedTitle}>Check your email</Text>
          <Text style={styles.confirmedBody}>
            We sent a confirmation link to{' '}
            <Text style={{ color: T.primary }}>{email}</Text>.
            {'\n\n'}
            Click it to activate your account, then come back and sign in.
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already confirmed? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
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
        <View style={styles.header}>
          <Text style={styles.wordmark}>Delphi</Text>
          <Text style={styles.tagline}>Your full money picture, at a glance.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create account</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Neal"
              placeholderTextColor={T.textDim}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="givenName"
              returnKeyType="next"
            />
          </View>

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
              placeholder="At least 6 characters"
              placeholderTextColor={T.textDim}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={T.primaryFg} />
              : <Text style={styles.buttonText}>Create account</Text>
            }
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes('already registered')) return 'An account with this email already exists.';
  if (msg.includes('network'))            return 'Network error. Check your connection.';
  if (msg.includes('weak_password'))      return 'Password must be at least 6 characters.';
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
  // confirmed state
  confirmedContainer: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['8'],
  },
  confirmedCard: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['12'],
    marginTop: space['16'],
    gap: space['6'],
    width: '100%',
    maxWidth: 360,
  },
  confirmedTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  confirmedBody: {
    fontSize: fontSize.md,
    color: T.textMuted,
    lineHeight: 22,
  },
});
