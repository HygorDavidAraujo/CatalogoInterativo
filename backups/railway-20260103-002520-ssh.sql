mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 9.5.0, for Linux (x86_64)
--
-- Host: localhost    Database: railway
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
Warning: A partial dump from a server that has GTIDs will by default include the GTIDs of all transactions, even those that changed suppressed parts of the database. If you don't want to restore GTIDs, pass --set-gtid-purged=OFF. To make a complete dump, pass --all-databases --triggers --routines --events. 
Warning: A dump from a server that has GTIDs enabled will by default include the GTIDs of all transactions, even those that were executed during its extraction and might not be represented in the dumped data. This might result in an inconsistent data dump. 
In order to ensure a consistent backup of the database, pass --single-transaction or --lock-all-tables or --source-data. 
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '';

--
-- Table structure for table `configuracoes`
--

DROP TABLE IF EXISTS `configuracoes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracoes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_site` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `titulo` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `telefone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `endereco` text COLLATE utf8mb4_unicode_ci,
  `whatsapp` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instagram` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facebook` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `configuracoes`
--

LOCK TABLES `configuracoes` WRITE;
/*!40000 ALTER TABLE `configuracoes` DISABLE KEYS */;
INSERT INTO `configuracoes` VALUES (1,'DAVINI VINHOS FINOS','R├│tulos que despertam sentidos','Uma sele├º├úo dos melhores vinhos para voc├¬.','(62)98183-1483','hygordavidaraujo@gmail.com','Goi├ónia, Goi├ís, Brasil','5562981831483','https://instagram.com/davinivinhos','','2025-12-12 05:41:46');
/*!40000 ALTER TABLE `configuracoes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedidos`
--

DROP TABLE IF EXISTS `pedidos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pendente',
  `observacoes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pedidos_usuario_id` (`usuario_id`),
  KEY `idx_pedidos_status` (`status`),
  CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedidos`
--

LOCK TABLES `pedidos` WRITE;
/*!40000 ALTER TABLE `pedidos` DISABLE KEYS */;
INSERT INTO `pedidos` VALUES (1,2,54.90,'finalizado','Pedido via WhatsApp','2025-12-10 05:15:26'),(2,3,109.80,'finalizado','Pedido via WhatsApp','2025-12-10 17:20:34'),(3,3,109.80,'finalizado','Pedido via WhatsApp','2025-12-10 17:23:07'),(4,4,721.40,'finalizado','Pedido via WhatsApp','2025-12-12 05:29:00'),(5,1,84.90,'finalizado','Pedido via WhatsApp','2025-12-14 01:47:06'),(6,1,120.90,'finalizado','Pedido via WhatsApp','2025-12-21 14:41:14'),(7,2,36.00,'finalizado','Pedido via WhatsApp','2025-12-21 15:10:22'),(8,1,764.80,'finalizado','Pedido via WhatsApp','2025-12-22 03:33:24');
/*!40000 ALTER TABLE `pedidos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pedidos_itens`
--

DROP TABLE IF EXISTS `pedidos_itens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pedidos_itens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pedido_id` int NOT NULL,
  `vinho_id` int NOT NULL,
  `vinho_nome` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade` int NOT NULL,
  `preco_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pedidos_itens_pedido` (`pedido_id`),
  KEY `idx_pedidos_itens_vinho` (`vinho_id`),
  CONSTRAINT `pedidos_itens_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  CONSTRAINT `pedidos_itens_ibfk_2` FOREIGN KEY (`vinho_id`) REFERENCES `vinhos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pedidos_itens`
--

LOCK TABLES `pedidos_itens` WRITE;
/*!40000 ALTER TABLE `pedidos_itens` DISABLE KEYS */;
INSERT INTO `pedidos_itens` VALUES (1,1,1,'Novecento - Bodega Dante Robino',1,54.90,54.90),(2,2,1,'Novecento - Bodega Dante Robino 750ml',2,54.90,109.80),(3,3,1,'Novecento - Bodega Dante Robino 750ml',2,54.90,109.80),(4,4,5,'Tannat Reserva - Jolimont 750ml',1,129.00,129.00),(5,4,3,'J├║lia Florista - Vidigal Wines 750ml',1,79.90,79.90),(6,4,1,'Novecento - Bodega Dante Robino 750ml',2,54.90,109.80),(7,4,10,'Cabernet Sauvignon com Carvalho - Jolimont 750ml',1,79.00,79.00),(8,4,15,'Moscatel Branco - Jolimont 375ml',1,69.00,69.00),(9,4,21,'Tantehue Dem├¡-sec - Vi├▒a Ventisquero 750ml',3,84.90,254.70),(10,5,21,'Tantehue Dem├¡-sec - Vi├▒a Ventisquero 750ml',1,84.90,84.90),(11,6,21,'Tantehue Dem├¡-sec - Vi├▒a Ventisquero 750ml',1,84.90,84.90),(12,6,22,'Suco de Uva Tinto Integral 1L - Jolimont',1,36.00,36.00),(13,7,23,'Suco de Uva Branco Integral 1L - Jolimont',1,36.00,36.00),(14,8,25,'Toro de Piedra Reserva 750ml- Vinha Requingua',2,85.90,171.80),(15,8,23,'Suco de Uva Branco Integral 1L - Jolimont',3,36.00,108.00),(16,8,22,'Suco de Uva Tinto Integral 1L - Jolimont',3,36.00,108.00),(17,8,18,'Moscatel Branco Dem├¡-sec - Jolimont 750ml',1,119.00,119.00),(18,8,12,'Vinho Tinto Suave Reserva - Jolimont 750ml',2,129.00,258.00);
/*!40000 ALTER TABLE `pedidos_itens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome_completo` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senha` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_admin` tinyint(1) DEFAULT '0',
  `cpf` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logradouro` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complemento` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bairro` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cep` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cidade` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estado` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_usuarios_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Admin','(62)98183-1483','hygordavidaraujo@gmail.com','$2b$10$s8MjC4GpWH8NBveRLtiiNueadnQUPEwDrCUxAVJrVn3Zl5HRcuMny',1,'','Rua Cristo Redentor','sn','Qd 15, Lt 9, Casa 2','Jardim Petr├│polis','74460-110','Goi├ónia','GO','2025-12-10 04:14:58'),(2,'Barbara de Souza Amorim Araujo','(62)98269-5169','barbaraamorimfono@gmail.com','$2b$10$vK544DCkz0Az86kOslGXieT0mwhWiT61t0tsEVkETLpBfFSu1RJaS',0,'057.044.181-12',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-10 05:14:34'),(3,'Aelisvag David Soares','(62)98248-0031','aelisvag@gmail.com','$2b$10$6JcpezocmfklgXVVr57kNebxXAVMWem.ASu9LREkcUQ6NQcYm4y5u',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-10 17:20:19'),(4,'Hyulle David Araujo','(62)98100-6097','hyullearaujo@gmail.com','$2b$10$3IZBwvCgpsQBoPABrNIIBuo.KztXsw/okcukc5DEasM6AonlCdI6m',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-12 05:27:55'),(5,'Luiz Filipe','(62)9262-7932','luizfilipeamoriim@gmail.com','$2b$10$WXM/wyk8yKNYxySozvxTjeDRazsGEKvM24hPV17ZwZioKzOqwelKS',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-29 02:05:01');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vinhos`
--

DROP TABLE IF EXISTS `vinhos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vinhos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uva` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ano` int DEFAULT NULL,
  `preco` decimal(10,2) NOT NULL,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `harmonizacao` text COLLATE utf8mb4_unicode_ci,
  `guarda` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `imagem` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vinhos_nome` (`nome`),
  KEY `idx_vinhos_uva` (`uva`),
  KEY `idx_vinhos_tipo` (`tipo`),
  KEY `idx_vinhos_ativo_created` (`ativo`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vinhos`
--

LOCK TABLES `vinhos` WRITE;
/*!40000 ALTER TABLE `vinhos` DISABLE KEYS */;
INSERT INTO `vinhos` VALUES (1,'Novecento - Bodega Dante Robino 750ml','tinto','Cabernet Sauvignon',2023,42.90,'Um Cabernet argentino de Mendoza, acess├¡vel, frutado e f├ícil de beber, ideal para o dia a dia.\r\nCor: Rubi intenso com reflexos viol├íceos.\r\nAromas: frutas vermelhas frescas, especiarias; notas de ameixa, groselha e figo em compota.\r\nPaladar: taninos macios, boa acidez, f├ícil de beber; final persistente.','Carnes vermelhas Grelhadas, massas de molho vermelho, queijos semiduros.','4 a 6 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/v1765342968/vinhos/kbwuo5ok8p0voprirdma.png',1,'2025-12-10 05:02:49'),(2,'Brut Branco - Jolimont 750ml','espumante','Chardonnay, Pinot Noir',2024,119.00,'Apresenta colora├º├úo amareloÔÇæpalha com reflexos esverdeados e perlage fina e persistente. No nariz, revela aromas de frutas brancas, como ma├º├ú verde e pera, aliados a notas c├¡tricas e delicados toques de p├úo tostado e fermento, caracter├¡sticos do estilo Brut. Em boca, mostra perfil seco e refrescante, com acidez equilibrada, corpo leve a m├®dio e final limpo, garantindo excelente versatilidade gastron├┤mica.','Peixes grelhados, Frutos do mar, Sushi e sashimi, Queijos leves, Saladas, Canap├®s, Carnes brancas, Pratos leves do dia a dia','1 a 3 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765349527/vinhos/cytesxohn3tog3rvhoyj.png',1,'2025-12-10 06:52:09'),(3,'J├║lia Florista - Vidigal Wines 750ml','tinto','Aragon├¬s, Castel├úo, Trincadeira',2023,66.90,'Pa├¡s: Portugal\r\nApresenta colora├º├úo rubi brilhante e aromas intensos de frutas vermelhas maduras, acompanhados por notas vegetais e nuances de especiarias. Em boca, revela perfil macio e redondo, com corpo leve a m├®dio, acidez equilibrada e final agrad├ível, mantendo a eleg├óncia t├¡pica dos tintos da regi├úo de Lisboa. Um vinho vers├ítil, f├ícil de beber e com excelente rela├º├úo qualidadeÔÇæpre├ºo.','Carnes vermelhas e brancas, Peixes gordos, Pratos de peixe elaborados, Queijos de m├®dia intensidade.','3 a 5 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/v1765350016/vinhos/ilx4bolirzodcnra6pmr.png',1,'2025-12-10 07:00:17'),(4,'Morro Cal├ºado Reserva - Jolimont 750ml','tinto','Cabernet Sauvignon',2023,129.00,'Encorpado, complexo, amadurecido entre 6 e 8 meses em barricas de carvalho franc├¬s e americano, aromas intensos de frutas negras como ameixa, amora e framboesa, notas de carvalho, especiarias, tabaco, funghi e caf├®, acidez equilibrada, taninos intensos, untuoso, bom volume em boca, retrogosto persistente de caf├®','Cogumelos, massas com molhos vermelhos, carnes, pizza de calabresa','5 a 10 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765512098/vinhos/vnxlqfanwsgh8ylnomsh.png',1,'2025-12-12 04:01:40'),(5,'Tannat Reserva - Jolimont 750ml','tinto','Tannat',2020,129.00,'Notas de frutas negras e frutas em calda como ameixa, amora e licor de cassis, toque de couro, terroso, carvalho, tabaco, funghi e caf├®, aromas bem definidos de frutas passas e compotas, intenso, acidez equilibrada, taninos persistentes, bom volume em boca, retrogosto lembrando caf├® e tabaco, amadurecido 6 meses em barricas de carvalho franc├¬s e americano','Carnes gordas como cordeiro, costela bovina, cupim, carnes de ca├ºa como javali, pato, perdiz, churrasco, feijoada, queijos curados e intensos, embutidos fortes.','7 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765512424/vinhos/te8x8zguise2jidukbas.png',1,'2025-12-12 04:07:05'),(6,'Merlot Reserva - Jolimont 750ml','tinto','Merlot',2022,129.00,'Notas de frutas negras como ameixa, amora e framboesa, toques de ervas finas, tabaco e caf├®, acidez equilibrada, taninos persistentes e macios, vermelho rubi intenso, perfil frutado e sofisticado, ideal para jantares e ocasi├Áes especiais','Massas com molhos vermelhos leves, carnes brancas, carnes vermelhas magras, risotos, queijos semi duros, pizza marguerita ou calabresa, pratos com cogumelos.','5 a 10 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765512709/vinhos/wmudmxoflppemnlruxqo.png',1,'2025-12-12 04:11:49'),(7,'Pinot Noir Reserva - Jolimont 750ml','tinto','Pinot Noir',2023,129.00,'Elegante e sofisticado, produzido na Serra Ga├║cha, com perfil delicado e complexo, aromas intensos de frutas vermelhas, corpo leve a m├®dio, acidez equilibrada, ideal para apreciadores exigentes e momentos especiais','Carnes leves, carnes su├¡nas, peixes gordos, massas leves, risotos, queijos suaves, comida japonesa, pratos com cogumelos e trufa','3 a 5 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765512953/vinhos/kyi0irrnuklnjmefszpb.png',1,'2025-12-12 04:15:54'),(8,'Marselan Reserva - Jolimont 750ml','tinto','Marselan',2023,129.00,'Aromas intensos de frutas negras como amora e cereja, toques de ervas finas, tabaco e especiarias, taninos sedosos, acidez equilibrada, retrogosto longo, amadurecido 8 meses em barricas de carvalho franc├¬s e americano, vermelho rubi intenso e brilhante, perfil arom├ítico cheio de personalidade','Cogumelos, massas com molhos vermelhos, carnes de ca├ºa, risotos, queijos de m├®dia matura├º├úo','5 a 8 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765513218/vinhos/oht8xfhyyovcgpk7aohr.png',1,'2025-12-12 04:20:19'),(9,'Tannat Tradicional - Jolimont 750ml','tinto','Tannat',2024,79.00,'Vermelho rubi de m├®dia intensidade, brilhante, aromas de frutas negras, taninos firmes e persistentes, acidez equilibrada, corpo m├®dio a encorpado, vinho harmonioso e persistente com fino bouquet, elaborado com uvas Tannat cultivadas no Morro Cal├ºado em Canela','Carnes gordas, churrasco, feijoada, massas com molhos encorpados, queijos curados, embutidos fortes','5 a 7 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765513407/vinhos/rsebftzvr7zlapugby6s.png',1,'2025-12-12 04:23:28'),(10,'Cabernet Sauvignon com Carvalho - Jolimont 750ml','tinto','Cabernet Sauvignon',2022,79.00,'Aromas intensos de frutas negras como ameixa e amora, toques de especiarias, caf├® e tabaco, boa estrutura, acidez equilibrada, taninos macios e retrogosto longo. Amadurecimento de 3 meses em barricas de carvalho franc├¬s e americano. Perfil frutado, complexo e elegante, com visual vermelho rubi brilhante.','Massas com molhos vermelhos, carnes leves, risotos, pizzas, t├íbua de frios','5 a 8 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765513812/vinhos/nkuzc2jxsmx521lqahho.png',1,'2025-12-12 04:30:13'),(11,'Branco Suave - Jolimont 750ml','branco','Moscato',2024,79.00,'Paladar muito macio e frutado, aromas doces e frescos, combina├º├úo equilibrada entre dul├ºor e acidez, elaborado na Serra Ga├║cha, gradua├º├úo alco├│lica de 11,4%Jolimont, perfil leve, refrescante e encantador, ideal para quem aprecia vinhos suaves e arom├íticos.','Sushi com molho tar├¬, sobremesas, frutos do mar com molhos doces ou agridoces','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765514319/vinhos/mqnck68ufiz1lyeaxrqv.png',1,'2025-12-12 04:38:40'),(12,'Vinho Tinto Suave Reserva - Jolimont 750ml','tinto','Cabernet Sauvignon, Marselan e Tannat',2023,129.00,'Vermelho rubi de m├®dia intensidade, aromas de frutas negras em calda como ameixa, amora e licor de cassis, toques de especiarias doces, caf├® e chocolate ao leite, paladar cremoso e frutado, taninos macios, retrogosto persistente e frutado, elaborado com corte de quatro uvas e perfil marcante e envolvente.','Sobremesas, queijos leves, pratos agridoces, pizzas, massas leves','5 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/v1765514614/vinhos/rrhyfjq166c4wv76qsjk.png',1,'2025-12-12 04:43:35'),(13,'Morro Cal├ºado Reserva - Jolimont 375ml','tinto','Cabernet Sauvignon',2023,79.00,'Encorpado, complexo, amadurecido entre 6 e 8 meses em barricas de carvalho franc├¬s e americano, aromas intensos de frutas negras como ameixa, amora e framboesa, notas de carvalho, especiarias, tabaco, funghi e caf├®, acidez equilibrada, taninos intensos, untuoso, bom volume em boca, retrogosto persistente de caf├®','Cogumelos, massas com molhos vermelhos, carnes, pizza de calabresa','5 a 10 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765514796/vinhos/wouikmftp7a4hllbhah1.png',1,'2025-12-12 04:46:38'),(14,'Moscatel Branco - Jolimont 750ml','espumante','Moscato',2023,119.00,'Espumante doce mais premiado do Brasil, elaborado na Serra Ga├║cha, perlage fino e persistente, aromas florais e de frutas c├¡tricas, sabor leve, fresco e adocicado, produzido pelo m├®todo Charmat, gradua├º├úo alco├│lica de 7,5%, cor amareloÔÇæesverdeada brilhante, ideal para celebra├º├Áes e momentos ao ar livre','Sobremesas, frutas frescas, queijos leves, pratos agridoces, tortas doces, saladas de frutas','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/c_fit,w_400,h_400,q_auto,f_auto/v1765515029/vinhos/vpwa6fl1v3mzrqnmxjg9.png',1,'2025-12-12 04:50:30'),(15,'Moscatel Branco - Jolimont 375ml','espumante','Moscato',2023,69.00,'Espumante doce mais premiado do Brasil, elaborado na Serra Ga├║cha, perlage fino e persistente, aromas florais e de frutas c├¡tricas, sabor leve, fresco e adocicado, produzido pelo m├®todo Charmat, gradua├º├úo alco├│lica de 7,5%, cor amareloÔÇæesverdeada brilhante, ideal para celebra├º├Áes e momentos ao ar livre','Sobremesas, frutas frescas, queijos leves, pratos agridoces, tortas doces, saladas de frutas','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765515290/vinhos/trtvb70rxvrgabqby2dv.png',1,'2025-12-12 04:54:51'),(16,'Moscatel Ros├® - Jolimont 750ml','espumante','Moscato',2023,119.00,'os├® blush elegante, perlage fino e persistente, aromas florais e de frutas vermelhas, sabor leve, fresco e adocicado, teor alco├│lico 7,5%, estilo delicado e rom├óntico, ideal para celebra├º├Áes e momentos especiais. A vin├¡cola destaca sua delicadeza e sofistica├º├úo na apresenta├º├úo do produto','Sobremesas, frutas frescas, pratos agridoces, tortas doces, queijos leves','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765515464/vinhos/y9a0uigwxj0fmzs5gptc.png',1,'2025-12-12 04:57:44'),(17,'Brut Ros├® - Jolimont 750ml','espumante','Chardonnay, Pinot Noir',2024,119.00,'Leve, refrescante e perfeito para dias ensolarados, colora├º├úo ros├® cereja de baixa intensidade com brilho delicado e perlage fina e persistenteJolimont, aromas intensos e delicados com notas florais e frutadas, teor alco├│lico 12,5%, elaborado na Serra Ga├║cha, ideal para celebra├º├Áes descontra├¡das ou momentos ├á beira da piscina','Aperitivos, frutos do mar, saladas, queijos leves, pratos frescos e dias ensolarados','2 a 3 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765515624/vinhos/s4f3h7symrpzctm5fwrw.png',1,'2025-12-12 05:00:25'),(18,'Moscatel Branco Dem├¡-sec - Jolimont 750ml','espumante','Moscato',2023,119.00,'Tonalidade amarelo palha com reflexos esverdeados, perlage fina e persistente, aromas delicados e frescos, perfil elegante e equilibrado entre do├ºura e acidez, elaborado na Serra Ga├║cha, ideal para celebra├º├Áes e momentos especiais','Sobremesas leves, frutas frescas, pratos agridoces, queijos suaves, tortas doces','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765515849/vinhos/rcociv2pvhkjnzicot9p.png',1,'2025-12-12 05:04:11'),(19,'Moscatel Branco Zero Alcool - Jolimont 750ml','espumante','Moscato',2024,119.00,'Tonalidade amareloÔÇæesverdeado de baixa intensidade, perlage fino e persistente, aroma intenso e delicado com notas florais e frutas de polpa branca e c├¡tricas, sabor leve, fresco e adocicado, teor alco├│lico 0%, ideal para celebra├º├Áes sem restri├º├Áes e para quem busca uma experi├¬ncia borbulhante sem ├ílcool','Sobremesas, frutas frescas, pratos agridoces, tortas doces, queijos leves','2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1765516016/vinhos/nfcmmq0xovxxsbwdnkpn.png',1,'2025-12-12 05:06:57'),(20,'Chilano Red Blend - Chilano 750ml','tinto','Cabernet Sauvignon, Syrah',2021,49.90,'Corpo m├®dio, taninos presentes e boa acidez, aromas ricos de frutas vermelhas como morango, amora, mirtilo e framboesa, estrutura equilibrada, perfil frutado e f├ícil de beber, produzido no Valle Central pela vin├¡cola Chilano, conhecida por processos modernos e rigorosos de vinifica├º├úo','Carnes grelhadas, massas com molhos vermelhos, pizzas, queijos m├®dios, hamb├║rguer artesanal','3 a 5 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/v1765516339/vinhos/p8iym1nuaqw86inczuza.webp',1,'2025-12-12 05:12:20'),(21,'Tantehue Dem├¡-sec - Vi├▒a Ventisquero 750ml','rose','Cabernet Sauvignon',2025,79.90,'Ros├® chileno fresco e frutado, tom avermelhado, aromas de morango e suaves fragr├óncias florais com toques de violeta, estrutura ligeiramente t├ónica, acidez bem balanceada, elaborado em cubas de a├ºo inox, teor alco├│lico entre 12% e 12,5%','Peixes, mariscos, aves e queijos frescos','2 a 3 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/v1765516983/vinhos/jafm5j3etcyhxdrwzshz.webp',1,'2025-12-12 05:23:04'),(22,'Suco de Uva Tinto Integral 1L - Jolimont','suco_integral_tinto','Bord├┤, Isabel',2024,36.00,'Suco viol├íceo, brilhante, com notas frutadas intensas, equilibrando do├ºura e acidez','','','https://res.cloudinary.com/dkurbmoya/image/upload/v1766326729/vinhos/ynswuf3afdt6l6mpmpzt.png',1,'2025-12-21 14:18:53'),(23,'Suco de Uva Branco Integral 1L - Jolimont','suco_integral_branco','Ni├ígara',2024,36.00,'Suco de cor Amarelo palha e brilhante. Intenso e n├¡tido, caracter├¡stico da uva Ni├ígara com notas florais. Em boca ├® leve, do├ºura e acidez equilibradas, f├ícil de beber.','','','https://res.cloudinary.com/dkurbmoya/image/upload/v1766329661/vinhos/fcfg8siczuo6lsmmnhvp.png',1,'2025-12-21 15:07:43'),(24,'Suco de Uva Tinto Integral 300ML - Jolimont','suco_integral_tinto','Bord├┤, Isabel',2024,18.00,'Suco viol├íceo, brilhante, com notas frutadas intensas, equilibrando do├ºura e acidez','','','https://res.cloudinary.com/dkurbmoya/image/upload/v1766330348/vinhos/ordrlkaxo0esc7zndc7e.png',1,'2025-12-21 15:19:09'),(25,'Toro de Piedra Reserva 750ml- Vinha Requingua','tinto','Pinot Noir',2024,85.90,'Possui cor vermelho cereja brilhante, muito atraente na ta├ºa. Aromas de frutas vermelhas frescas como framboesa, morango, com toque de cedro. Sabor e textura cremosa, taninos delicados, final macio e equilibrado. Em resumo, um Pinot Noir elegante, fresco e f├ícil de beber, ideal para momentos descontra├¡dos ou acompanhando refei├º├Áes leves.','vers├ítil e combina com carnes vermelhas leves como fil├® mignon ou cordeiro, queijos macios e semiduros ,brie, gouda, parmes├úo, massas com molhos suaves, fiambres e pizzas','2 a 4 anos','https://res.cloudinary.com/dkurbmoya/image/upload/c_fit,w_400,h_400,q_auto,f_auto/c_fit,w_400,h_400,q_auto,f_auto/v1766350649/vinhos/v5wob2kc0v6srykkc1rj.png',1,'2025-12-21 20:57:30'),(26,'Finca Terranostra Branco Suave 750ml - Fecovita coop','branco','Riesling - Vin├¡feras Brancas',2025,54.90,'Um delicioso varietal argentino da regi├úo de Mendoza. Possui colora├º├úo amarelo palha, aromas de frutas c├¡tricas','Ideal para dias quentes, acompanha saladas, peixes, massas leves e canap├®s.','1 a 2 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1766869780/vinhos/g0wacynfqoeqymhikpts.jpg',1,'2025-12-27 21:09:41'),(28,'Finca Terranostra Blend Dem├¡-sec 750ml - Fecovita coop','tinto','Malbec, Bonarda e Tempranillo',2024,54.90,'Possui colora├º├úo vermelho rubi intensa. No nariz, destaca-se por aromas de frutas vermelhas e negras maduras, como ameixa, amora e cereja, com toques de especiarias. No paladar, ├® encorpado, frutado, com taninos suaves e boa persist├¬ncia.','Combina bem com carnes vermelhas grelhadas, massas com molhos condimentados, queijos de m├®dia cura e pratos levemente picantes.','2 a 3 anos','https://res.cloudinary.com/dkurbmoya/image/upload/v1766870473/vinhos/jgivocxctbkcgf5ctjla.jpg',1,'2025-12-27 21:21:14');
/*!40000 ALTER TABLE `vinhos` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-03  3:25:22
