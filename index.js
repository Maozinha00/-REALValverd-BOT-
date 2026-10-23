require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Inicialização com os intents necessários
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Ative "Server Members Intent" no Discord Developer Portal!
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

let hierarchyMessageId = process.env.MESSAGE_ID || config.messageId || null;
let isUpdating = false;

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Erro ao salvar config.json:', err);
  }
}

// =============================================================
// 1. SISTEMA DE HIERARQUIA OFICIAL REALVALVERD
// =============================================================

/**
 * Monta o painel oficial da REALValverd com o layout solicitado
 */
async function buildHierarchyEmbed(guild) {
  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setColor(config.embedColor || '#22C55E')
    .setTitle('👑 REALVALVERD • PAINEL DE HIERARQUIA ⚔️')
    .setDescription(
      '```ansi\n' +
      '\x1b[1;32m╔══════════════════════════════════════╗\n' +
      '          👑 REALVALVERD 👑\n' +
      '       ⚔️ PAINEL DE HIERARQUIA ⚔️\n' +
      '╚══════════════════════════════════════╝\x1b[0m\n\n' +
      '       🔥 DISCIPLINA • UNIÃO • RESPEITO 🔥\n' +
      '             💚 PODER • LEALDADE 💚\n' +
      '```\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .setTimestamp()
    .setFooter({ 
      text: '💚 REALVALVERD 💚 • ⚔️ MAIS QUE UMA FACÇÃO, UMA FAMÍLIA ⚔️', 
      iconURL: guild.iconURL({ dynamic: true }) || undefined 
    });

  let totalFactionMembers = 0;
  const countedMemberIds = new Set();

  const roleTitleMap = {
    '00': '👑  00  ┃ LIDERANÇA SUPREMA',
    '01': '⭐  01  ┃ SUB-LÍDER / BRAÇO DIREITO',
    '02': '🛡️  02  ┃ CONSELHO',
    '03': '🎖️  03  ┃ AUDITORIA / GERÊNCIA EXECUTIVA',
    'gerente geral': '💼  ┃ GERENTE GERAL',
    'gerente de farm': '🌾  ┃ GERENTE DE FARM',
    'gerente de vendas': '💰  ┃ GERENTE DE VENDAS',
    'gerente de ação': '⚔️  ┃ GERENTE DE AÇÃO',
    'gerente de acao': '⚔️  ┃ GERENTE DE AÇÃO',
    'gerente de rec': '📋  ┃ GERENTE DE REC',
    'gerente de recrutamento': '📋  ┃ GERENTE DE REC',
    'elite': '⚜️  ┃ ELITE',
    'supervisor': '👁️  ┃ SUPERVISOR',
    'membro': '🥋  ┃ MEMBRO',
    'morador': '🏠  ┃ MORADOR',
    'entroza': '🌱  ┃ ENTROZA',
  };

  for (let i = 0; i < config.roles.length; i++) {
    const roleDef = config.roles[i];
    const roleKey = roleDef.name.toLowerCase().trim();

    // Busca cargo pelo ID numérico (se houver) ou pelo nome exato no servidor
    const discordRole = guild.roles.cache.find(
      (r) => (roleDef.discordRoleId && r.id === roleDef.discordRoleId) || r.name.toLowerCase().trim() === roleKey
    );

    let membersInRole = [];
    if (discordRole) {
      membersInRole = Array.from(discordRole.members.values());
    }

    membersInRole.forEach((m) => countedMemberIds.add(m.id));

    const formattedTitle = roleTitleMap[roleKey] || `${roleDef.badgeEmoji}  ${roleDef.name.toUpperCase()}`;
    const roleTitle = `${formattedTitle}  (${membersInRole.length})`;

    let membersListString = '';
    if (membersInRole.length === 0) {
      membersListString = '> *Nenhum membro vinculado.*';
    } else {
      membersListString = membersInRole
        .map((m) => {
          const name = m.displayName || m.user.username;
          return `> • <@${m.id}> (${name})`;
        })
        .join('\n');
    }

    embed.addFields({
      name: roleTitle,
      value: membersListString,
      inline: false,
    });

    // Separador entre cúpula e gerência
    if (roleKey === '03') {
      embed.addFields({
        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        value: '\u200b',
        inline: false,
      });
    }
  }

  totalFactionMembers = countedMemberIds.size;

  embed.addFields(
    {
      name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: '\u200b',
      inline: false,
    },
    {
      name: '📊  CENTRAL DA FACÇÃO',
      value: 
        `👥 **Total de membros:** ${totalFactionMembers}\n` +
        `🛡️ **Cargos cadastrados:** ${config.roles.length}\n` +
        '🤖 **Sistema:** ONLINE\n' +
        '🔄 **Sincronização automática de cargos:** ATIVADA',
      inline: false,
    },
    {
      name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: '```yaml\n💚 REALVALVERD 💚\n⚔️ MAIS QUE UMA FACÇÃO, UMA FAMÍLIA ⚔️\n```',
      inline: false,
    }
  );

  return embed;
}

/**
 * Atualiza ou envia o painel de hierarquia
 */
async function updateHierarchyPanel(reason = 'Rotina') {
  if (isUpdating) return;
  isUpdating = true;

  try {
    const guildId = process.env.GUILD_ID || config.guildId;
    const channelId = process.env.CHANNEL_ID || config.channelId;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.error(`[ERRO] Servidor ${guildId} não encontrado.`);
      isUpdating = false;
      return;
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error(`[ERRO] Canal de Hierarquia ${channelId} não encontrado ou sem permissão.`);
      isUpdating = false;
      return;
    }

    const embed = await buildHierarchyEmbed(guild);

    const refreshButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_refresh_panel')
        .setLabel('🔄 Atualizar Painel')
        .setStyle(ButtonStyle.Secondary)
    );

    if (hierarchyMessageId) {
      try {
        const existingMessage = await channel.messages.fetch(hierarchyMessageId).catch(() => null);
        if (existingMessage) {
          await existingMessage.edit({ embeds: [embed], components: [refreshButton] });
          console.log(`[AUTO-SYNC] Painel de Hierarquia atualizado! Motivo: ${reason}`);
          isUpdating = false;
          return;
        }
      } catch (err) {
        console.log('[INFO] Mensagem anterior de hierarquia não encontrada, criando nova...');
      }
    }

    const newMessage = await channel.send({ embeds: [embed], components: [refreshButton] });
    hierarchyMessageId = newMessage.id;
    config.messageId = newMessage.id;
    saveConfig();
    console.log(`[AUTO-SYNC] Novo painel de hierarquia publicado! ID: ${newMessage.id}`);
  } catch (error) {
    console.error('[ERRO] Falha ao atualizar hierarquia:', error);
  } finally {
    isUpdating = false;
  }
}

// =============================================================
// 2. SISTEMA DE SUGESTÕES (PAINEL + FORMULÁRIO + VOTAÇÃO 👍 / ❌)
// =============================================================

/**
 * Publica ou mantém o painel fixo de sugestões no canal: 1562101766353330226
 */
async function setupSuggestionPanel(guild) {
  try {
    const panelChannelId = process.env.SUGGESTION_PANEL_CHANNEL_ID || config.suggestionPanelChannelId || '1562101766353330226';
    const channel = await guild.channels.fetch(panelChannelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error(`[ERRO] Canal do Painel de Sugestões (${panelChannelId}) não encontrado.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#22C55E')
      .setTitle('💡 REALVALVERD • CENTRAL DE SUGESTÕES 📋')
      .setDescription(
        '**Tem alguma ideia ou melhoria para a nossa facção?**\n\n' +
        '• Sugestões de **ações, invasões e estratégias de PvP**\n' +
        '• Ideias de **farm, rotas e metas de recursos**\n' +
        '• Recrutamento, regras e melhorias internas\n\n' +
        '👇 **Clique no botão abaixo** para abrir o formulário. Sua sugestão será postada automaticamente no canal de votação para a tropa avaliar com 👍 e ❌!'
      )
      .setFooter({ 
        text: '💚 REALVALVERD 💚 • A voz de cada membro constrói nosso império',
        iconURL: guild.iconURL({ dynamic: true }) || undefined
      })
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_open_suggestion_modal')
        .setLabel('💡 Enviar Sugestão')
        .setStyle(ButtonStyle.Success)
    );

    if (config.suggestionPanelMessageId) {
      const existing = await channel.messages.fetch(config.suggestionPanelMessageId).catch(() => null);
      if (existing) {
        await existing.edit({ embeds: [embed], components: [actionRow] });
        console.log('✅ Painel fixo de sugestões sincronizado com sucesso!');
        return;
      }
    }

    const panelMsg = await channel.send({ embeds: [embed], components: [actionRow] });
    config.suggestionPanelMessageId = panelMsg.id;
    saveConfig();
    console.log(`✅ Novo Painel de Sugestões criado no canal! ID: ${panelMsg.id}`);
  } catch (err) {
    console.error('Erro ao configurar painel de sugestões:', err);
  }
}

// =============================================================
// 3. EVENTOS DO BOT
// =============================================================

client.once('ready', async () => {
  console.log('=====================================================');
  console.log(`🤖 Bot REALValverd conectado como: ${client.user.tag}`);
  console.log('⚡ Monitoramento da Hierarquia: ATIVADO');
  console.log('💡 Painel de Sugestões com Votação (👍 / ❌): ATIVADO');
  console.log('=====================================================');

  const guildId = process.env.GUILD_ID || config.guildId;
  const guild = await client.guilds.fetch(guildId).catch(() => null);

  if (guild) {
    await updateHierarchyPanel('Inicialização do Bot');
    await setupSuggestionPanel(guild);
  }

  setInterval(() => {
    updateHierarchyPanel('Checagem Periódica de Segurança');
  }, (config.updateIntervalSeconds || 30) * 1000);
});

// Atualizações de cargos em tempo real
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const added = newRoles.filter((r) => !oldRoles.has(r.id));
  const removed = oldRoles.filter((r) => !newRoles.has(r.id));

  if (added.size > 0 || removed.size > 0) {
    const roleNames = config.roles.map((r) => r.name.toLowerCase().trim());
    const isRelevant = [...added.values(), ...removed.values()].some((r) =>
      roleNames.includes(r.name.toLowerCase().trim()) ||
      config.roles.some((cfg) => cfg.discordRoleId === r.id)
    );

    if (isRelevant) {
      console.log(`[AUTO-VERIFICAÇÃO] Cargo alterado em @${newMember.user.tag}. Atualizando painel...`);
      await updateHierarchyPanel(`Cargo alterado em @${newMember.user.tag}`);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Membro saiu: ${member.user.tag}`);
  await updateHierarchyPanel(`Membro saiu: ${member.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  console.log(`[AUTO-VERIFICAÇÃO] Novo membro entrou: ${member.user.tag}`);
  await updateHierarchyPanel(`Novo membro: ${member.user.tag}`);
});

// Interações: Botões e Formulário Modal
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. Botão de atualizar painel de hierarquia
    if (interaction.isButton() && interaction.customId === 'btn_refresh_panel') {
      await interaction.deferUpdate();
      await updateHierarchyPanel(`Clique no botão por @${interaction.user.tag}`);
      return;
    }

    // 2. Botão de abrir modal de sugestão no canal 1562101766353330226
    if (interaction.isButton() && interaction.customId === 'btn_open_suggestion_modal') {
      const modal = new ModalBuilder()
        .setCustomId('modal_submit_suggestion')
        .setTitle('💡 Enviar Sugestão — REALValverd');

      const titleInput = new TextInputBuilder()
        .setCustomId('input_suggestion_title')
        .setLabel('Título ou Assunto da Sugestão')
        .setPlaceholder('Ex: Novo horário de farm coletivo de coletes')
        .setStyle(TextInputStyle.Short)
        .setMinLength(5)
        .setMaxLength(100)
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('input_suggestion_desc')
        .setLabel('Descreva sua ideia em detalhes')
        .setPlaceholder('Explique como sua sugestão vai fortalecer a facção...')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(15)
        .setMaxLength(1000)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // 3. Recebe o envio da sugestão e posta no canal 1562101028277457047 com 👍 e ❌
    if (interaction.isModalSubmit() && interaction.customId === 'modal_submit_suggestion') {
      const title = interaction.fields.getTextInputValue('input_suggestion_title');
      const description = interaction.fields.getTextInputValue('input_suggestion_desc');

      const targetChannelId = process.env.SUGGESTION_FEED_CHANNEL_ID || config.suggestionTargetChannelId || '1562101028277457047';
      const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);

      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({
          content: '❌ Erro: O canal de votação de sugestões não foi encontrado ou está sem permissão.',
          ephemeral: true,
        });
        return;
      }

      // Monta o Embed formatado da sugestão
      const suggestionEmbed = new EmbedBuilder()
        .setColor('#22C55E')
        .setTitle('💡 NOVA SUGESTÃO REGISTRADA')
        .setAuthor({
          name: `${interaction.user.displayName || interaction.user.username} (@${interaction.user.tag})`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
          { name: '📌 Assunto', value: title, inline: false },
          { name: '📝 Sugestão', value: description, inline: false },
          { name: '👤 Autor', value: `<@${interaction.user.id}>`, inline: true },
          { name: '🟡 Status', value: '`Em Votação Pública`', inline: true }
        )
        .setFooter({
          text: `REALValverd • Votação Popular • ID do Autor: ${interaction.user.id}`,
        })
        .setTimestamp();

      // Envia no canal de votação
      const suggestionMessage = await targetChannel.send({ embeds: [suggestionEmbed] });

      // Adiciona as reações 👍 (joia) e ❌ (x) para a galera votar
      await suggestionMessage.react('👍');
      await suggestionMessage.react('❌');

      // Resposta privada para quem enviou
      await interaction.reply({
        content: `✅ **Sua sugestão foi enviada com sucesso!**\nEla foi publicada no canal <#${targetChannelId}> para a tropa votar com 👍 ou ❌.`,
        ephemeral: true,
      });

      console.log(`[SUGESTÃO] Sugestão de @${interaction.user.tag} enviada para o canal de votação!`);
    }
  } catch (err) {
    console.error('Erro na interação:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro ao processar sua ação.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
