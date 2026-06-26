import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uppercaseRe = /[A-Z]/;
const numberRe = /[0-9]/;
const symbolRe = /[^A-Za-z0-9]/;

function validate({ name, email, password }) {
  const errors = {};

  if (!name.trim()) {
    errors.name = 'Name is required';
  } else if (name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!emailRe.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (!uppercaseRe.test(password)) {
    errors.password = 'Password must contain at least one uppercase letter';
  } else if (!numberRe.test(password)) {
    errors.password = 'Password must contain at least one number';
  } else if (!symbolRe.test(password)) {
    errors.password = 'Password must contain at least one special character';
  }

  return errors;
}

function PasswordStrength({ password }) {
  if (!password) return null;

  const checks = [
    { label: 'Uppercase', ok: uppercaseRe.test(password) },
    { label: 'Number', ok: numberRe.test(password) },
    { label: 'Symbol', ok: symbolRe.test(password) },
    { label: '8+ chars', ok: password.length >= 8 },
  ];

  const score = checks.filter((c) => c.ok).length;
  const barColor =
    score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-orange-400' : score === 3 ? 'bg-yellow-400' : 'bg-green-500';

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? barColor : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(({ label, ok }) => (
          <span key={label} className={`text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            {ok ? '✓' : '○'} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        const mapped = {};
        data.errors.forEach(({ field, message }) => { mapped[field] = message; });
        setFieldErrors(mapped);
      } else {
        setServerError(data?.error || 'Registration failed. Please try again.');
      }
    }
  }

  const inputClass = (field) =>
    `w-full px-4 py-2.5 rounded-lg border text-sm transition
     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
     ${fieldErrors[field]
       ? 'border-red-400 bg-red-50 text-red-900 placeholder-red-300'
       : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
     }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg select-none">M</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">MeetPoint</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">Start collaborating in real-time — free forever</p>

        {serverError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Smith"
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              className={inputClass('name')}
            />
            {fieldErrors.name && (
              <p id="name-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={inputClass('email')}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={inputClass('password')}
            />
            <PasswordStrength password={form.password} />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1.5 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
              bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60
              text-white text-sm font-semibold transition-colors focus:outline-none
              focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isLoading ? (
              <>
                <Spinner />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            By creating an account you agree to our{' '}
            <span className="text-indigo-500 cursor-pointer hover:underline">Terms</span> and{' '}
            <span className="text-indigo-500 cursor-pointer hover:underline">Privacy Policy</span>.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
