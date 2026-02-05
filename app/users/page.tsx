'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserRole, UserStatus } from '@/types';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_URL = '/api';

export default function UsersPage() {
  const { canAccessUsers, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    creci: '',
    role: UserRole.VENDEDOR,
    password: '',
  });

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    
    if (!canAccessUsers) {
      router.push('/dashboard');
      return;
    }
    
    hasInitialized.current = true;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fechar menu de ações ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuOpen !== null) {
        const target = event.target as HTMLElement;
        if (!target.closest('.actions-menu-container')) {
          setActionsMenuOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsMenuOpen]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        // Formato: (00) 0000-0000
        return numbers
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        // Formato: (00) 00000-0000
        return numbers
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);

      const response = await axios.get(`${API_URL}/usuarios/`, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      // A API pode retornar os usuários diretamente ou em response.data.users
      const usersList = Array.isArray(response.data) ? response.data : (response.data.users || []);
      setUsers(usersList);
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao carregar usuários:', error);
      alert('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Editar usuário existente

        const params = new URLSearchParams({
          name: formData.name,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
          role: formData.role,
          ...(formData.creci && { creci: formData.creci }),
          ...(formData.password && { password: formData.password }),
        });

        await axios.put(`${API_URL}/usuarios/atualizar/${editingUser.id}?${params.toString()}`, null, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        alert('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário

        const newUserData = {
          name: formData.name,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
          creci: formData.creci || null,
          role: formData.role,
          status: UserStatus.APPROVED, // Usuários criados por admin são aprovados automaticamente
          password: formData.password,
          first_login: true,
        };

        await axios.post(`${API_URL}/usuarios/criar`, newUserData, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        alert('Usuário criado com sucesso!');
      }

      // Recarregar lista de usuários
      await loadUsers();
      resetForm();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao salvar usuário:', error);

      if (axios.isAxiosError(error) && error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Erro ao salvar usuário');
      }
    }
  };

  const handleApprove = async (userId: string) => {
    try {

      await axios.put(`${API_URL}/usuarios/aprovar`,{
        idUsuario: userId,
        status: UserStatus.APPROVED,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert('Usuário aprovado com sucesso!');

      // Recarregar lista de usuários
      await loadUsers();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao aprovar usuário:', error);
      alert('Erro ao aprovar usuário');
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('Tem certeza que deseja rejeitar este usuário?')) return;

    try {

      await axios.put(`${API_URL}/usuarios/aprovar`, {
        idUsuario: userId,
        status: UserStatus.REJECTED,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert('Usuário rejeitado!');

      // Recarregar lista de usuários
      await loadUsers();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao rejeitar usuário:', error);
      alert('Erro ao rejeitar usuário');
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja resetar a senha de ${userName}?\n\nA senha será redefinida para: 123456\nO usuário precisará alterá-la no próximo login.`)) return;

    try {

      await axios.post(`${API_URL}/usuarios/reset-password`, {
        userId,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert('Senha resetada com sucesso!\n\nNova senha: 123456\nO usuário deverá alterá-la no próximo login.');

      // Recarregar lista de usuários
      await loadUsers();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao resetar senha:', error);
      alert('Erro ao resetar senha do usuário');
    }
  };

  const handleToggleActive = async (userId: string, userName: string, currentActive: boolean) => {
    const action = currentActive ? 'desativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${action} o usuário ${userName}?`)) return;

    try {

      await axios.put(`${API_URL}/usuarios/toggle-active`, {
        userId,
        active: !currentActive,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert(`Usuário ${action}do com sucesso!`);

      // Recarregar lista de usuários
      await loadUsers();
    } catch (error) {
      console.error(`[UsersPage] ❌ Erro ao ${action} usuário:`, error);
      alert(`Erro ao ${action} usuário`);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, userRole: UserRole) => {
    if (userRole === UserRole.DEV) {
      alert('Não é possível excluir usuários com perfil de desenvolvedor.');
      return;
    }

    if (!confirm(`⚠️ ATENÇÃO: Esta ação não pode ser desfeita!\n\nTem certeza que deseja EXCLUIR permanentemente o usuário ${userName}?`)) return;

    try {

      await axios.delete(`${API_URL}/usuarios/excluir`, {
        data: { userId },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert('Usuário excluído com sucesso!');

      // Recarregar lista de usuários
      await loadUsers();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao excluir usuário:', error);
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Erro ao excluir usuário');
      }
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    try {

      await axios.put(`${API_URL}/usuarios/role`, {
        idUsuario: userId,
        role: newRole,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      alert('Cargo do usuário alterado com sucesso!');

      // Fechar modal e recarregar lista
      setIsRoleModalOpen(false);
      setSelectedUserForRole(null);
      await loadUsers();
    } catch (error) {
      console.error('[UsersPage] ❌ Erro ao alterar cargo:', error);
      alert('Erro ao alterar cargo do usuário');
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUserForRole(user);
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setIsRoleModalOpen(false);
    setSelectedUserForRole(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      cpf: '',
      phone: '',
      creci: '',
      role: UserRole.VENDEDOR,
      password: '',
    });
    setIsCreating(false);
    setEditingUser(null);
  };

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      [UserRole.DEV]: 'bg-purple-100 text-purple-800 border-purple-200',
      [UserRole.ADMIN]: 'bg-blue-100 text-blue-800 border-blue-200',
      [UserRole.VENDEDOR]: 'bg-green-100 text-green-800 border-green-200',
    };

    const labels = {
      [UserRole.DEV]: 'Desenvolvedor',
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.VENDEDOR]: 'Vendedor',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  const getActiveBadge = (active?: boolean) => {
    if (active === false) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
          </svg>
          Inativo
        </span>
      );
    }
    return null;
  };

  if (!canAccessUsers) {
    return null;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pr-0 lg:pr-20">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">Gerenciamento de Usuários</h1>
          <p className="text-sm sm:text-base text-gray-200 opacity-70 dark:text-[var(--foreground)] mt-1">
            Crie e gerencie usuários do sistema
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 w-full sm:w-auto justify-center shadow-md hover:shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Novo Usuário</span>
            <span className="sm:hidden">Novo</span>
          </button>
        )}
      </div>

      {/* Seção de Usuários Pendentes */}
      {users.filter(u => u.status === UserStatus.PENDING).length > 0 ? (
        <div className="bg-[var(--card-bg)] rounded-xl shadow-md border border-[var(--border)] overflow-visible">
          <div className="bg-gradient-to-r from-[var(--warning)] to-[var(--warning-dark)] px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 text-[var(--foreground)] p-2 rounded-lg flex-shrink-0 backdrop-blur-sm">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-[var(--foreground)] truncate">
                  Cadastros Pendentes
                </h2>
                <p className="text-[var(--foreground)] opacity-90 text-xs sm:text-sm">
                  {users.filter(u => u.status === UserStatus.PENDING).length} vendedor(es) aguardando
                </p>
              </div>
            </div>
          </div>

          {/* Tabela para Desktop - apenas telas muito grandes */}
          <div className="hidden xl:block overflow-visible">
            <table className="w-full">
              <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    CPF
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Perfil
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.filter(u => u.status === UserStatus.PENDING).map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{user.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-300 font-mono">
                        {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-medium border bg-[var(--warning)]/20 text-[var(--accent-light)] border-[var(--warning)]">
                        Pendente
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="px-3 py-1 text-[var(--foreground)] bg-[var(--success)] hover:bg-[var(--success-dark)] border border-[var(--success)] rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-3 py-1 text-[var(--foreground)] bg-[var(--danger)] hover:bg-[var(--danger-dark)] border border-[var(--danger)] rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards para Tablet e Mobile */}
          <div className="xl:hidden divide-y divide-[var(--border)]">
            {users.filter(u => u.status === UserStatus.PENDING).map((user) => (
              <div key={user.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{user.name}</h3>
                    <p className="text-sm text-gray-300 mt-1">{user.email}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium border bg-[var(--warning)]/20 text-[var(--accent-light)] border-[var(--warning)]">
                    Pendente
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-400 w-20">CPF:</span>
                    <span className="text-[var(--foreground)] font-mono">
                      {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-400 w-20">CRECI:</span>
                    <span className="text-[var(--foreground)]">{user.creci || '-'}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-400 w-20">Perfil:</span>
                    {getRoleBadge(user.role)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(user.id)}
                    className="flex-1 px-4 py-2 text-[var(--foreground)] bg-[var(--success)] hover:bg-[var(--success-dark)] border border-[var(--success)] rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    ✓ Aprovar
                  </button>
                  <button
                    onClick={() => handleReject(user.id)}
                    className="flex-1 px-4 py-2 text-[var(--foreground)] bg-[var(--danger)] hover:bg-[var(--danger-dark)] border border-[var(--danger)] rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    ✗ Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Formulário de Criação/Edição */}
      {isCreating && (
        <div className="bg-[var(--card-bg)] rounded-xl shadow-md border border-[var(--border)] overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            <p className="text-white/90 text-sm mt-1">Preencha os dados abaixo para {editingUser ? 'atualizar o' : 'criar um novo'} usuário</p>
          </div>
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all"
                  placeholder="João da Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all"
                  placeholder="joao@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  CPF *
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all font-mono"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  CRECI <span className="text-[var(--foreground)]/50 text-xs font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.creci}
                  onChange={(e) => setFormData({ ...formData, creci: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all"
                  placeholder="CRECI 12345-F"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  Perfil *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value={UserRole.ADMIN}>👑 Administrador</option>
                  <option value={UserRole.VENDEDOR}>💼 Vendedor</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--foreground)] opacity-90 mb-2">
                  Senha {editingUser ? <span className="text-[var(--foreground)]/50 text-xs font-normal">(deixe em branco para manter a atual)</span> : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  className="w-full px-4 py-2.5 bg-[var(--surface)] text-[var(--foreground)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-[var(--foreground)]/40 transition-all"
                  placeholder="••••••••"
                  minLength={6}
                />
                {!editingUser && (
                  <p className="mt-1.5 text-xs text-[var(--foreground)]/60">Mínimo de 6 caracteres</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--border)] mt-6">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] border-2 border-[var(--border)] px-8 py-3 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Geral de Usuários */}
      <div className="bg-[var(--card-bg)] rounded-xl shadow-md border border-[var(--border)] overflow-visible mb-6">
        <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] px-6 py-4 rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 text-[var(--foreground)] p-2 rounded-lg backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Todos os Usuários
                </h2>
                {isLoading ? (
                  <div className="h-5 w-32 bg-white/20 rounded animate-pulse mt-1"></div>
                ) : (
                  <p className="text-white opacity-90 text-sm">
                    {users.filter(u => u.status !== UserStatus.PENDING).length} usuário(s) no total
                  </p>
                )}
              </div>
            </div>

            {/* Filtro de Status */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-[var(--primary)] shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  statusFilter === 'approved'
                    ? 'bg-white text-[var(--primary)] shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                Aprovados
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  statusFilter === 'rejected'
                    ? 'bg-white text-[var(--primary)] shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                Rejeitados
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <>
            {/* Skeleton para Desktop */}
            <div className="hidden xl:block overflow-visible">
              <table className="w-full">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      CPF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Perfil
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Situação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-5 w-32 bg-[var(--surface)] rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-5 w-28 bg-[var(--surface)] rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-5 w-28 bg-[var(--surface)] rounded animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-6 w-24 bg-[var(--surface)] rounded-full animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-6 w-24 bg-[var(--surface)] rounded-full animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-6 w-20 bg-[var(--surface)] rounded-full animate-pulse"></div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-9 w-20 bg-[var(--surface)] rounded-lg animate-pulse"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Skeleton para Mobile/Tablet */}
            <div className="xl:hidden divide-y divide-[var(--border)]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-6 w-48 bg-[var(--surface)] rounded animate-pulse"></div>
                      <div className="h-4 w-64 bg-[var(--surface)] rounded animate-pulse"></div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="h-6 w-20 bg-[var(--surface)] rounded-full animate-pulse"></div>
                      <div className="h-6 w-16 bg-[var(--surface)] rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="h-4 w-full bg-[var(--surface)] rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-[var(--surface)] rounded animate-pulse"></div>
                    <div className="h-4 w-2/3 bg-[var(--surface)] rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-[var(--surface)] rounded animate-pulse"></div>
                  </div>
                  <div className="h-10 w-full bg-[var(--surface)] rounded-lg animate-pulse"></div>
                </div>
              ))}
            </div>
          </>
        ) : users.filter(u => {
          if (u.status === UserStatus.PENDING) return false;
          if (statusFilter === 'approved') return u.status === UserStatus.APPROVED;
          if (statusFilter === 'rejected') return u.status === UserStatus.REJECTED;
          return true;
        }).length > 0 ? (
          <>
            {/* Tabela para Desktop - apenas telas muito grandes */}
            <div className="hidden xl:block overflow-visible">
              <table className="w-full">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      CPF
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Perfil
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Situação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--foreground)] opacity-80 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {users.filter(u => {
                    if (u.status === UserStatus.PENDING) return false;
                    if (statusFilter === 'approved') return u.status === UserStatus.APPROVED;
                    if (statusFilter === 'rejected') return u.status === UserStatus.REJECTED;
                    return true;
                  }).map((user) => (
                    <tr key={user.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-[var(--foreground)]">{user.name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)] opacity-70 font-mono">
                          {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-[var(--foreground)] opacity-70">
                          {user.phone ? user.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {user.status === UserStatus.APPROVED ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white border border-emerald-600 shadow-md">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white border border-red-600 shadow-md">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Rejeitado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {user.active === true ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white border border-emerald-600 shadow-md">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-500 text-white border border-gray-600 shadow-md">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap relative">
                        <div className="actions-menu-container">
                          <button
                            onClick={() => setActionsMenuOpen(actionsMenuOpen === user.id ? null : user.id)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors shadow-md"
                            title="Ações"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                            Ações
                          </button>

                          {actionsMenuOpen === user.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-[var(--card-bg)] rounded-lg shadow-lg border border-[var(--border)] py-1 z-50">
                              <button
                                onClick={() => {
                                  setSelectedUserForDetails(user);
                                  setIsDetailsModalOpen(true);
                                  setActionsMenuOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                              >
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver Detalhes
                              </button>
                              <button
                                onClick={() => {
                                  openRoleModal(user);
                                  setActionsMenuOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                              >
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                Alterar Cargo
                              </button>
                              <button
                                onClick={() => {
                                  handleResetPassword(user.id, user.name);
                                  setActionsMenuOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                              >
                                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Resetar Senha
                              </button>
                              <div className="border-t border-[var(--border)] my-1"></div>
                              <button
                                onClick={() => {
                                  handleToggleActive(user.id, user.name, user.active === true);
                                  setActionsMenuOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                              >
                                {user.active === true ? (
                                  <>
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                    Desativar Usuário
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Ativar Usuário
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteUser(user.id, user.name, user.role);
                                  setActionsMenuOpen(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[var(--danger)]/20 flex items-center gap-2 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Excluir Usuário
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards para Tablet e Mobile */}
            <div className="xl:hidden divide-y divide-[var(--border)]">
              {users.filter(u => {
                if (u.status === UserStatus.PENDING) return false;
                if (statusFilter === 'approved') return u.status === UserStatus.APPROVED;
                if (statusFilter === 'rejected') return u.status === UserStatus.REJECTED;
                return true;
              }).map((user) => (
                <div key={user.id} className="p-4 hover:bg-[var(--surface-hover)] transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{user.name}</h3>
                      <p className="text-sm text-gray-300 mt-1">{user.email}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {user.status === UserStatus.APPROVED ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--success)]/20 text-[var(--accent-light)] border border-[var(--success)]">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--danger)]/20 text-red-300 border border-[var(--danger)]">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Rejeitado
                        </span>
                      )}
                      {user.active === true ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--success)]/20 text-[var(--accent-light)] border border-[var(--success)]">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600/30 text-gray-400 border border-gray-600">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-400 w-20">CPF:</span>
                      <span className="text-[var(--foreground)] font-mono">
                        {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-400 w-20">Telefone:</span>
                      <span className="text-[var(--foreground)]">
                        {user.phone ? user.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-400 w-20">CRECI:</span>
                      <span className="text-[var(--foreground)]">{user.creci || '-'}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-medium text-gray-400 w-20">Perfil:</span>
                      {getRoleBadge(user.role)}
                    </div>
                  </div>

                  <div className="relative actions-menu-container">
                    <button
                      onClick={() => setActionsMenuOpen(actionsMenuOpen === user.id ? null : user.id)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors shadow-md"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                      Ações
                    </button>

                    {actionsMenuOpen === user.id && (
                      <div className="absolute left-0 right-0 bottom-full mb-1 bg-[var(--card-bg)] rounded-lg shadow-lg border border-[var(--border)] py-1 z-50">
                        <button
                          onClick={() => {
                            setSelectedUserForDetails(user);
                            setIsDetailsModalOpen(true);
                            setActionsMenuOpen(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver Detalhes
                        </button>
                        <button
                          onClick={() => {
                            openRoleModal(user);
                            setActionsMenuOpen(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Alterar Cargo
                        </button>
                        <button
                          onClick={() => {
                            handleResetPassword(user.id, user.name);
                            setActionsMenuOpen(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Resetar Senha
                        </button>
                        <div className="border-t border-[var(--border)]"></div>
                        <button
                          onClick={() => {
                            handleToggleActive(user.id, user.name, user.active === true);
                            setActionsMenuOpen(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors"
                        >
                          {user.active === true ? (
                            <>
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Desativar Usuário
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Ativar Usuário
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteUser(user.id, user.name, user.role);
                            setActionsMenuOpen(null);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-[var(--danger)]/20 flex items-center gap-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Excluir Usuário
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--surface)] rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-300 text-lg">
              {statusFilter === 'approved' && 'Nenhum usuário aprovado'}
              {statusFilter === 'rejected' && 'Nenhum usuário rejeitado'}
              {statusFilter === 'all' && 'Nenhum usuário cadastrado'}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {statusFilter === 'approved' && 'Aprove usuários pendentes para vê-los aqui'}
              {statusFilter === 'rejected' && 'Usuários rejeitados aparecerão aqui'}
              {statusFilter === 'all' && 'Aguarde solicitações de cadastro'}
            </p>
          </div>
        )}
      </div>

      {/* Modal de Alteração de Cargo */}
      {isRoleModalOpen && selectedUserForRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-[var(--border)]">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Alterar Cargo</h3>
                <button
                  onClick={closeRoleModal}
                  className="text-[var(--foreground)] hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6">
              {/* Informações do Usuário */}
              <div className="bg-[var(--surface)] rounded-lg p-4 mb-6 border border-[var(--border)]">
                <div className="flex items-start gap-3">
                  <div className="bg-[var(--primary)]/20 rounded-full p-2">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-[var(--foreground)] text-lg">{selectedUserForRole.name}</h4>
                    <p className="text-sm text-gray-300 mt-1">{selectedUserForRole.email}</p>
                    <div className="mt-2">
                      <span className="text-xs text-gray-400">Cargo atual: </span>
                      {getRoleBadge(selectedUserForRole.role)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seleção de Cargo */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Selecione o novo cargo:
                </label>

                {Object.values(UserRole).filter(role => role !== UserRole.DEV).map((role) => (
                  <button
                    key={role}
                    onClick={() => handleChangeRole(selectedUserForRole.id, role)}
                    disabled={selectedUserForRole.role === role}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedUserForRole.role === role
                        ? 'bg-[var(--surface)]/50 border-[var(--border)] cursor-not-allowed opacity-60'
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface-hover)] shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {role === UserRole.ADMIN && '👑'}
                          {role === UserRole.VENDEDOR && '💼'}
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {role === UserRole.ADMIN && 'Administrador'}
                            {role === UserRole.VENDEDOR && 'Vendedor'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {role === UserRole.ADMIN && 'Gerenciamento de usuários e mapas'}
                            {role === UserRole.VENDEDOR && 'Vendas e reservas de lotes'}
                          </p>
                        </div>
                      </div>
                      {selectedUserForRole.role === role && (
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-[var(--success)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium text-[var(--accent-light)]">Atual</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="bg-[var(--surface)] px-6 py-4 rounded-b-xl flex justify-end border-t border-[var(--border)]">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Usuário */}
      {isDetailsModalOpen && selectedUserForDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div
            className="bg-[var(--card-bg)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Detalhes do Usuário</h3>
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-[var(--foreground)] hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Nome */}
                <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                  <p className="text-lg font-semibold text-[var(--foreground)]">{selectedUserForDetails.name}</p>
                </div>

                {/* Email */}
                <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <p className="text-lg text-[var(--foreground)]">{selectedUserForDetails.email}</p>
                </div>

                {/* CPF */}
                <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                  <label className="block text-sm font-medium text-gray-400 mb-1">CPF</label>
                  <p className="text-lg font-mono text-[var(--foreground)]">
                    {selectedUserForDetails.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                  </p>
                </div>

                {/* Telefone e CRECI - em grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Telefone</label>
                    <p className="text-lg text-[var(--foreground)]">
                      {selectedUserForDetails.phone
                        ? selectedUserForDetails.phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')
                        : 'Não informado'
                      }
                    </p>
                  </div>

                  <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                    <label className="block text-sm font-medium text-gray-400 mb-1">CRECI</label>
                    <p className="text-lg text-[var(--foreground)]">
                      {selectedUserForDetails.creci || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* Perfil e Status - em grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Perfil</label>
                    <div className="flex items-center">
                      {getRoleBadge(selectedUserForDetails.role)}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                    <div className="flex items-center">
                      {selectedUserForDetails.status === UserStatus.APPROVED ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--success)]/20 text-[var(--accent-light)] border border-[var(--success)]">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Aprovado
                        </span>
                      ) : selectedUserForDetails.status === UserStatus.REJECTED ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--danger)]/20 text-red-300 border border-[var(--danger)]">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Rejeitado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--warning)]/20 text-[var(--accent-light)] border border-[var(--warning)]">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Data de Cadastro */}
                {selectedUserForDetails.createdAt && (
                  <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Cadastrado em</label>
                    <p className="text-lg text-[var(--foreground)]">
                      {new Date(selectedUserForDetails.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="bg-[var(--surface)] px-6 py-4 rounded-b-xl flex justify-end gap-3 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openRoleModal(selectedUserForDetails);
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-[var(--primary-light)] transition-colors flex items-center gap-2 shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Alterar Cargo
              </button>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
